using Antares.Server.Connections;
using Bogus;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Tables;

/// <summary>
/// Phase 11 endpoints: 8 table-write actions under /api/tables/.
///
/// DDL (create / alter / duplicate / truncate / drop) and data mutation
/// (updateCell / deleteRows / insertFakeRows). Per-DB SQL syntax differences
/// are handled inline via Sanitize / per-dialect SQL templates.
///
/// Cell value escaping uses parameterized queries via SqlSugar where possible
/// to avoid R13 SQL injection. SQLite ALTER (drop column, rename column) on
/// older SQLite versions requires the 6-step CREATE-COPY-DROP-RENAME emulation
/// — for now we use SqlSugar's built-in fallback and let DB testing surface
/// gaps (Phase 11 Plan §602).
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class TablesWriteService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly ILogger<TablesWriteService> _logger;

    public TablesWriteService(ConnectionRegistry registry, ILogger<TablesWriteService> logger)
    {
        _registry = registry;
        _logger = logger;
    }

    [HttpPost("/api/tables/create"), NonUnify]
    public async Task<object> Create([FromBody] CreateTablePayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        if (p.Columns is null || p.Columns.Count == 0)
            throw new ArgumentException("at least one column is required");

        var colsSql = string.Join(", ", p.Columns.Select(c => RenderColumn(entry.Client, c)));
        var pk = p.Columns.Where(c => c.IsPrimary).Select(c => QuoteIdent(entry.Client, c.Name)).ToList();
        if (pk.Count > 0) colsSql += $", PRIMARY KEY ({string.Join(", ", pk)})";
        var sql = $"CREATE TABLE {qualified} ({colsSql})";

        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/alter"), NonUnify]
    public async Task<object> Alter([FromBody] AlterTablePayload p, CancellationToken ct)
    {
        // 漸進式實作 — per plan T3-T5:
        //   T3 (本 commit): Options.Comment / Options.Name 路徑 (table-level metadata)
        //   T4 (next):       Additions[] (ADD COLUMN)
        //   T5 (last):       Deletions / Changes / IndexChanges / ForeignChanges / CheckChanges
        // 未實作的操作維持 stub 行為 (return success 不動 DB) — 等後續 commit 補.
        var entry = _registry.Require(p.Uid);

        if (p.Options is not null && p.Options.Count > 0)
        {
            await ApplyTableOptionsAsync(entry, p.Schema, p.Table, p.Options, ct);
        }

        _logger.LogInformation(
            "ALTER TABLE {Table} — options={OptCount}, additions={Adds}, changes={Chg}, deletions={Del}",
            p.Table,
            p.Options?.Count ?? 0,
            p.Additions?.Count ?? 0,
            p.Changes?.Count ?? 0,
            p.Deletions?.Count ?? 0);

        return new { status = "success" };
    }

    /// <summary>
    /// 套用表級選項 diff (rename / comment / collation / engine / autoIncrement).
    /// T3 階段實作 MSSQL comment 路徑;其他 client / 其他 option 之後補.
    /// </summary>
    private static async Task ApplyTableOptionsAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        Dictionary<string, object?> options, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(table)) return;

        if (options.TryGetValue("comment", out var commentObj))
        {
            var comment = commentObj?.ToString() ?? string.Empty;
            await SetTableCommentAsync(entry, schema, table, comment, ct);
        }
        // TODO T5: rename / collation / engine / autoIncrement
    }

    /// <summary>
    /// 設定 / 更新表級註解,per-flavor:
    ///   mssql: sys.extended_properties (MS_Description, class=1, minor_id=0)
    ///   mysql: ALTER TABLE ... COMMENT='...'
    ///   pg:    COMMENT ON TABLE ... IS '...'
    ///   sqlite: 無 native 註解,無動作.
    /// </summary>
    private static async Task SetTableCommentAsync(
        ConnectionRegistry.Entry entry, string? schema, string table,
        string comment, CancellationToken ct)
    {
        switch (entry.Client)
        {
            case "mssql":
            {
                // 用 IF EXISTS / ELSE 兩條 stored proc 切換 add / update.
                // sp_updateextendedproperty 在 description 不存在時會 raise error,
                // 所以必須先確認再選分支. minor_id=0 表「table 自己」(非 column).
                const string sql = @"
IF EXISTS (
    SELECT 1 FROM sys.extended_properties ep
    JOIN sys.tables t ON ep.major_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = @sc AND t.name = @t
      AND ep.minor_id = 0 AND ep.class = 1 AND ep.name = 'MS_Description'
)
    EXEC sp_updateextendedproperty 'MS_Description', @v, 'SCHEMA', @sc, 'TABLE', @t;
ELSE
    EXEC sp_addextendedproperty 'MS_Description', @v, 'SCHEMA', @sc, 'TABLE', @t;";
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql,
                    new { sc = schema, t = table, v = comment }), ct);
                break;
            }
            case "mysql":
            case "maria":
            {
                var qualifiedTable = QualifyTable(entry.Client, schema, table);
                var escapedComment = comment.Replace("'", "''");
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(
                    $"ALTER TABLE {qualifiedTable} COMMENT='{escapedComment}'"), ct);
                break;
            }
            case "pg":
            {
                var qualifiedTable = QualifyTable(entry.Client, schema, table);
                var escapedComment = comment.Replace("'", "''");
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(
                    $"COMMENT ON TABLE {qualifiedTable} IS '{escapedComment}'"), ct);
                break;
            }
            // sqlite: 無 native 表級註解,無動作.
        }
    }

    [HttpPost("/api/tables/duplicate"), NonUnify]
    public async Task<object> Duplicate([FromBody] DuplicateTablePayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var src = QualifyTable(entry.Client, p.Schema, p.Source);
        var dst = QualifyTable(entry.Client, p.Schema, p.Destination);
        var sql = entry.Client switch
        {
            "mssql" => $"SELECT * INTO {dst} FROM {src} WHERE 1=0",
            "mysql" or "maria" => $"CREATE TABLE {dst} LIKE {src}",
            "pg" => $"CREATE TABLE {dst} (LIKE {src} INCLUDING ALL)",
            "sqlite" => $"CREATE TABLE {dst} AS SELECT * FROM {src} WHERE 1=0",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) throw new NotSupportedException($"duplicate not supported for {entry.Client}");
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        if (p.CopyData)
        {
            var copy = $"INSERT INTO {dst} SELECT * FROM {src}";
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(copy), ct);
        }
        return new { status = "success" };
    }

    [HttpPost("/api/tables/truncate"), NonUnify]
    public async Task<object> Truncate([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var sql = entry.Client switch
        {
            "sqlite" => $"DELETE FROM {qualified}",   // SQLite has no TRUNCATE
            _ => $"TRUNCATE TABLE {qualified}"
        };
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/drop"), NonUnify]
    public async Task<object> Drop([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP TABLE {qualified}"), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/updateCell"), NonUnify]
    public async Task<object> UpdateCell([FromBody] UpdateCellPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var col = QuoteIdent(entry.Client, p.Column ?? string.Empty);

        if (p.Primary is null || p.Primary.Count == 0)
            throw new ArgumentException("primary key cell identifier required");

        var whereParts = new List<string>();
        var paramObj = new Dictionary<string, object?> { ["v"] = p.Value };
        var i = 0;
        foreach (var kv in p.Primary)
        {
            var pname = $"p{i}";
            whereParts.Add($"{QuoteIdent(entry.Client, kv.Key)} = @{pname}");
            paramObj[pname] = kv.Value;
            i += 1;
        }
        var sql = $"UPDATE {qualified} SET {col} = @v WHERE {string.Join(" AND ", whereParts)}";
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql, paramObj), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/deleteRows"), NonUnify]
    public async Task<object> DeleteRows([FromBody] DeleteRowsPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        if (p.Rows is null || p.Rows.Count == 0) return new { status = "success" };

        long affected = 0;
        foreach (var row in p.Rows)
        {
            var whereParts = new List<string>();
            var paramObj = new Dictionary<string, object?>();
            var i = 0;
            foreach (var kv in row)
            {
                var pname = $"p{i}";
                whereParts.Add($"{QuoteIdent(entry.Client, kv.Key)} = @{pname}");
                paramObj[pname] = kv.Value;
                i += 1;
            }
            var sql = $"DELETE FROM {qualified} WHERE {string.Join(" AND ", whereParts)}";
            affected += await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql, paramObj), ct);
        }
        return new { status = "success", response = affected };
    }

    [HttpPost("/api/tables/insertFakeRows"), NonUnify]
    public async Task<object> InsertFakeRows([FromBody] InsertFakeRowsPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var faker = new Faker();
        var inserted = 0;
        for (var n = 0; n < Math.Max(1, p.Count); n++)
        {
            ct.ThrowIfCancellationRequested();
            var values = new Dictionary<string, object?>();
            foreach (var col in p.Columns ?? new List<FakeColumnDto>())
            {
                values[col.Name] = GenerateFake(faker, col.Semantic, col.DataType);
            }
            if (values.Count == 0) break;
            var cols = string.Join(", ", values.Keys.Select(k => QuoteIdent(entry.Client, k)));
            var paramNames = string.Join(", ", values.Keys.Select(k => $"@{k}"));
            var sql = $"INSERT INTO {qualified} ({cols}) VALUES ({paramNames})";
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql, values), ct);
            inserted += 1;
        }
        return new { status = "success", response = inserted };
    }

    private static object? GenerateFake(Faker f, string? semantic, string? dataType)
    {
        var sem = (semantic ?? string.Empty).ToLowerInvariant();
        if (sem.Contains("email")) return f.Internet.Email();
        if (sem.Contains("url")) return f.Internet.Url();
        if (sem.Contains("fullname")) return f.Name.FullName();
        if (sem.Contains("firstname")) return f.Name.FirstName();
        if (sem.Contains("lastname")) return f.Name.LastName();
        if (sem.Contains("companyname")) return f.Company.CompanyName();
        if (sem.Contains("ip")) return f.Internet.Ip();
        if (sem.Contains("phone")) return f.Phone.PhoneNumber();
        if (sem.Contains("uuid") || sem.Contains("guid")) return Guid.NewGuid().ToString();
        if (sem.Contains("password")) return f.Internet.Password();
        if (sem.Contains("address")) return f.Address.StreetAddress();

        var dt = (dataType ?? string.Empty).ToLowerInvariant();
        if (dt.Contains("int")) return f.Random.Number();
        if (dt.Contains("float") || dt.Contains("double") || dt.Contains("decimal") || dt.Contains("numeric")) return f.Random.Double();
        if (dt.Contains("bool") || dt.Contains("bit")) return f.Random.Bool();
        if (dt.Contains("date") || dt.Contains("time")) return DateTime.UtcNow;
        return f.Lorem.Sentence();
    }

    private static string QualifyTable(string client, string? schema, string? table)
    {
        var t = table ?? string.Empty;
        var s = schema ?? string.Empty;
        return client switch
        {
            "mssql" => string.IsNullOrEmpty(s) ? $"[{Sanitize(t)}]" : $"[{Sanitize(s)}].[{Sanitize(t)}]",
            "mysql" or "maria" => string.IsNullOrEmpty(s) ? $"`{Sanitize(t)}`" : $"`{Sanitize(s)}`.`{Sanitize(t)}`",
            "pg" => string.IsNullOrEmpty(s) ? $"\"{Sanitize(t)}\"" : $"\"{Sanitize(s)}\".\"{Sanitize(t)}\"",
            _ => $"\"{Sanitize(t)}\""
        };
    }

    private static string QuoteIdent(string client, string name) => client switch
    {
        "mssql" => $"[{Sanitize(name)}]",
        "mysql" or "maria" => $"`{Sanitize(name)}`",
        "pg" => $"\"{Sanitize(name)}\"",
        _ => $"\"{Sanitize(name)}\""
    };

    private static string Sanitize(string s) =>
        s.Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "").Replace("--", "");

    private static string RenderColumn(string client, NewColumnDef c)
    {
        var name = QuoteIdent(client, c.Name);
        var type = c.Type ?? "VARCHAR(255)";
        var nullable = c.Nullable ? string.Empty : " NOT NULL";
        var def = string.IsNullOrEmpty(c.Default) ? string.Empty : $" DEFAULT {c.Default}";
        var auto = c.AutoIncrement ? client switch
        {
            "mysql" or "maria" => " AUTO_INCREMENT",
            "mssql" => " IDENTITY(1,1)",
            "pg" => "",
            "sqlite" => " AUTOINCREMENT",
            _ => ""
        } : string.Empty;
        return $"{name} {type}{auto}{nullable}{def}";
    }
}

// ---- Payloads / DTOs -------------------------------------------------------

public sealed class CreateTablePayload : TableTargetPayload
{
    public List<NewColumnDef> Columns { get; set; } = new();
}

public sealed class NewColumnDef
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "VARCHAR(255)";
    public bool Nullable { get; set; } = true;
    public string? Default { get; set; }
    public bool IsPrimary { get; set; }
    public bool AutoIncrement { get; set; }
}

public sealed class AlterTablePayload : TableTargetPayload
{
    /// <summary>渲染端送的完整 diff payload — 對應 WorkspaceTabPropsTable.vue saveChanges() params.</summary>
    public TableStructureDto? TableStructure { get; set; }
    public List<Dictionary<string, object?>>? Additions { get; set; }
    public List<Dictionary<string, object?>>? Changes { get; set; }
    public List<Dictionary<string, object?>>? Deletions { get; set; }
    public IndexChangesDto? IndexChanges { get; set; }
    public ForeignChangesDto? ForeignChanges { get; set; }
    public CheckChangesDto? CheckChanges { get; set; }
    /// <summary>表級選項 diff,key 包含 `comment`/`name`/`collation`/`engine`/`autoIncrement` 等.</summary>
    public Dictionary<string, object?>? Options { get; set; }
}

public sealed class TableStructureDto
{
    public string? Name { get; set; }
    public List<Dictionary<string, object?>>? Fields { get; set; }
    public List<Dictionary<string, object?>>? Foreigns { get; set; }
    public List<Dictionary<string, object?>>? Indexes { get; set; }
}

public sealed class IndexChangesDto
{
    public List<Dictionary<string, object?>>? Additions { get; set; }
    public List<Dictionary<string, object?>>? Changes { get; set; }
    public List<Dictionary<string, object?>>? Deletions { get; set; }
}

public sealed class ForeignChangesDto
{
    public List<Dictionary<string, object?>>? Additions { get; set; }
    public List<Dictionary<string, object?>>? Changes { get; set; }
    public List<Dictionary<string, object?>>? Deletions { get; set; }
}

public sealed class CheckChangesDto
{
    public List<Dictionary<string, object?>>? Additions { get; set; }
    public List<Dictionary<string, object?>>? Changes { get; set; }
    public List<Dictionary<string, object?>>? Deletions { get; set; }
}

public sealed class DuplicateTablePayload
{
    public string Uid { get; set; } = string.Empty;
    public string? Schema { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public bool CopyData { get; set; } = true;
}

public sealed class UpdateCellPayload : TableTargetPayload
{
    public string? Column { get; set; }
    public object? Value { get; set; }
    public Dictionary<string, object?>? Primary { get; set; }
}

public sealed class DeleteRowsPayload : TableTargetPayload
{
    public List<Dictionary<string, object?>>? Rows { get; set; }
}

public sealed class InsertFakeRowsPayload : TableTargetPayload
{
    public int Count { get; set; } = 1;
    public List<FakeColumnDto>? Columns { get; set; }
}

public sealed class FakeColumnDto
{
    public string Name { get; set; } = string.Empty;
    public string? DataType { get; set; }
    public string? Semantic { get; set; }
}
