using Antares.Server.Connections;
using Bogus;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;
using SqlSugar;
using static Antares.Server.Tables.TableDdl;

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
[Antares.Server.Infrastructure.ExceptionAsEnvelope]
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
        // raw: multi-option CREATE TABLE (per-flavor col defs, PK, auto-increment,
        // defaults) — DbMaintenance.CreateTable only accepts a List<DbColumnInfo>
        // that cannot express the full column grammar; SQL built by TableDdl.
        var entry = _registry.Require(p.Uid);
        if (p.Columns is null || p.Columns.Count == 0)
            throw new ArgumentException("at least one column is required");
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var sql = RenderCreateTable(entry.Client, qualified, p.Columns);

        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/alter"), NonUnify]
    public async Task<object> Alter([FromBody] AlterTablePayload p, CancellationToken ct)
    {
        // 漸進式實作 — per plan T3-T5:
        //   T3 (done): Options.Comment 路徑
        //   T4 (本 commit): Additions[] (ADD COLUMN per-flavor)
        //   T5 (next): Deletions / Changes / IndexChanges / ForeignChanges / CheckChanges
        var entry = _registry.Require(p.Uid);

        if (p.Options is not null && p.Options.Count > 0)
        {
            await ApplyTableOptionsAsync(entry, p.Schema, p.Table, p.Options, ct);
        }

        if (p.Additions is not null && p.Additions.Count > 0)
        {
            await ApplyAdditionsAsync(entry, p.Schema, p.Table, p.Additions, ct);
        }

        if (p.Deletions is not null && p.Deletions.Count > 0)
        {
            await ApplyDeletionsAsync(entry, p.Schema, p.Table, p.Deletions, ct);
        }

        if (p.Changes is not null && p.Changes.Count > 0)
        {
            await ApplyChangesAsync(entry, p.Schema, p.Table, p.Changes, ct);
        }

        if (p.IndexChanges is not null)
        {
            await ApplyIndexChangesAsync(entry, p.Schema, p.Table, p.IndexChanges, ct);
        }

        if (p.ForeignChanges is not null)
        {
            await ApplyForeignChangesAsync(entry, p.Schema, p.Table, p.ForeignChanges, ct);
        }

        if (p.CheckChanges is not null)
        {
            await ApplyCheckChangesAsync(entry, p.Schema, p.Table, p.CheckChanges, ct);
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
    /// DROP COLUMN per-flavor via SqlSugar DbMaintenance.DropColumn, which emits
    /// `ALTER TABLE <q> DROP COLUMN <q>` on mssql/mysql/maria/pg and `ALTER TABLE
    /// <q> DROP <q>` on sqlite (both forms valid). SqlSugar quotes schema+table+
    /// column per dialect (Gate-1: mssql [User], mysql/sqlite backtick, pg
    /// lowercased "user"). SQLite 3.35.0+ supports DROP COLUMN natively; older
    /// drivers surface their own error — same user-visible behavior as before.
    /// </summary>
    private static async Task ApplyDeletionsAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        List<FieldDto> deletions, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(table)) return;
        var qualified = string.IsNullOrEmpty(schema) ? table : $"{schema}.{table}";

        foreach (var f in deletions)
        {
            if (string.IsNullOrEmpty(f.Name)) continue;
            await Task.Run(() => entry.Db.DbMaintenance.DropColumn(qualified, f.Name), ct);
        }
    }

    /// <summary>
    /// CHANGE COLUMN per-flavor.這條路徑是 properties tab「修改欄位類型 / 重新命名 / 改 NOT NULL」走的:
    ///
    ///   mysql/maria: CHANGE COLUMN `oldName` `newName` TYPE(len) ... — 一次包 rename + alter
    ///   mssql:       sp_rename + ALTER COLUMN(rename 跟 type 改是兩條獨立指令)
    ///   pg:          RENAME COLUMN + ALTER COLUMN TYPE + ALTER COLUMN SET/DROP DEFAULT
    ///                + ALTER COLUMN SET/DROP NOT NULL
    ///   sqlite:      RENAME COLUMN(3.25+) — type 改不支援,我們 skip 並 log warn
    /// </summary>
    private async Task ApplyChangesAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        List<FieldDto> changes, CancellationToken ct)
    {
        // raw: type/rename change carries unsigned/zerofill/auto_increment/comment/
        // collation/on-update/array/enum plus per-flavor multi-statement ordering
        // (mssql sp_rename-then-alter, pg type+null+default+comment as 4 statements).
        // DbMaintenance.UpdateColumn/RenameColumn render only `ALTER ... {type}{len}`
        // and silently drop every modifier above — keep hand-rolled SQL.
        if (string.IsNullOrEmpty(table)) return;
        var qualified = QualifyTable(entry.Client, schema, table);

        foreach (var f in changes)
        {
            if (string.IsNullOrEmpty(f.Name) || string.IsNullOrEmpty(f.Type)) continue;

            // SQL built by TableDdl.RenderChangeColumn (per-dialect ordered statements,
            // some parameterized: mssql sp_rename + extended-property comment).
            var stmts = RenderChangeColumn(entry.Client, qualified, table, schema, f);
            if (stmts.Count == 0 && entry.Client == "sqlite")
                _logger.LogWarning("sqlite CHANGE COLUMN type/nullable not supported for {Col} — manual recreate required", f.Name);

            foreach (var s in stmts)
                await Task.Run(() => s.Params is null
                    ? entry.Db.Ado.ExecuteCommand(s.Sql)
                    : entry.Db.Ado.ExecuteCommand(s.Sql, s.Params), ct);
        }
    }

    /// <summary>
    /// IndexChanges per-flavor.主流是 mysql/maria 的 ALTER TABLE ADD/DROP INDEX,mssql/pg 走 CREATE INDEX / DROP INDEX 獨立語句.
    /// `Changes[]` 視為 drop-then-add(刪舊名字 + 加新定義).
    /// </summary>
    private static async Task ApplyIndexChangesAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        IndexChangesDto idx, CancellationToken ct)
    {
        // raw: DbMaintenance.CreateIndex hardcodes the index name as `Index_<t>_<c>`
        // (ignoring the user-supplied name the renderer round-trips), forces mssql
        // NONCLUSTERED, and has no PRIMARY-KEY path — the renderer supports named
        // unique/normal indexes AND primary keys. DROP-index by name is also
        // dialect-specific (mysql DROP PRIMARY KEY / DROP INDEX). Keep hand-rolled.
        if (string.IsNullOrEmpty(table)) return;
        var qualified = QualifyTable(entry.Client, schema, table);

        // DROP first(包含 Changes 的舊名)
        var drops = new List<IndexDto>();
        if (idx.Deletions is not null) drops.AddRange(idx.Deletions);
        if (idx.Changes is not null) drops.AddRange(idx.Changes.Select(c => new IndexDto
        {
            Name = c.OldName ?? c.Name, Type = c.OldType ?? c.Type, Fields = c.Fields
        }));

        foreach (var d in drops)
        {
            var sql = RenderDropIndexSql(entry.Client, qualified, d);
            if (!string.IsNullOrEmpty(sql))
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        }

        // ADD(包含 Changes 的新定義)
        var adds = new List<IndexDto>();
        if (idx.Additions is not null) adds.AddRange(idx.Additions);
        if (idx.Changes is not null) adds.AddRange(idx.Changes);

        foreach (var a in adds)
        {
            if (a.Fields is null || a.Fields.Count == 0) continue;
            var sql = RenderAddIndexSql(entry.Client, qualified, a);
            if (!string.IsNullOrEmpty(sql))
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        }
    }

    /// <summary>
    /// ForeignChanges per-flavor.MySQL 用 DROP/ADD FOREIGN KEY + CONSTRAINT,
    /// 其他 flavor 都是 standard ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT.
    /// </summary>
    private static async Task ApplyForeignChangesAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        ForeignChangesDto fk, CancellationToken ct)
    {
        // raw: DbMaintenance has no foreign-key ADD/DROP API; keep hand-rolled SQL.
        if (string.IsNullOrEmpty(table)) return;
        var qualified = QualifyTable(entry.Client, schema, table);

        // DROP first
        var drops = new List<string>();
        if (fk.Deletions is not null) drops.AddRange(fk.Deletions.Select(d => d.ConstraintName));
        if (fk.Changes is not null) drops.AddRange(fk.Changes.Select(c => c.OldName ?? c.ConstraintName));

        foreach (var name in drops.Where(n => !string.IsNullOrEmpty(n)))
        {
            var dropSql = entry.Client switch
            {
                "mysql" or "maria" => $"ALTER TABLE {qualified} DROP FOREIGN KEY `{Sanitize(name)}`",
                _ => $"ALTER TABLE {qualified} DROP CONSTRAINT {QuoteIdent(entry.Client, name)}"
            };
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(dropSql), ct);
        }

        // ADD(含 Changes 的新定義)
        var adds = new List<ForeignDto>();
        if (fk.Additions is not null) adds.AddRange(fk.Additions);
        if (fk.Changes is not null) adds.AddRange(fk.Changes);

        foreach (var a in adds)
        {
            if (string.IsNullOrEmpty(a.ConstraintName) || string.IsNullOrEmpty(a.Field)) continue;
            var sql = $"ALTER TABLE {qualified} ADD CONSTRAINT {QuoteIdent(entry.Client, a.ConstraintName)} "
                + $"FOREIGN KEY ({QuoteIdent(entry.Client, a.Field)}) "
                + $"REFERENCES {QualifyTable(entry.Client, a.RefSchema ?? schema, a.RefTable)} ({QuoteIdent(entry.Client, a.RefField)})"
                + (!string.IsNullOrEmpty(a.OnUpdate) ? $" ON UPDATE {a.OnUpdate}" : string.Empty)
                + (!string.IsNullOrEmpty(a.OnDelete) ? $" ON DELETE {a.OnDelete}" : string.Empty);
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        }
    }

    /// <summary>
    /// CheckChanges per-flavor.MySQL 8.0+/MariaDB 10.2+ 才支援 CHECK 約束,
    /// 之前版本 syntax 接受但 silently 忽略 — 我們直接送 SQL 讓 driver 報錯.
    /// </summary>
    private static async Task ApplyCheckChangesAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        CheckChangesDto chk, CancellationToken ct)
    {
        // raw: DbMaintenance has no CHECK-constraint ADD/DROP API; keep hand-rolled SQL.
        if (string.IsNullOrEmpty(table)) return;
        var qualified = QualifyTable(entry.Client, schema, table);

        // DROP first
        var dropNames = new List<string>();
        if (chk.Deletions is not null) dropNames.AddRange(chk.Deletions.Select(d => d.Name));
        if (chk.Changes is not null) dropNames.AddRange(chk.Changes.Select(c => c.Name));

        foreach (var name in dropNames.Where(n => !string.IsNullOrEmpty(n)))
        {
            var sql = $"ALTER TABLE {qualified} DROP CONSTRAINT {QuoteIdent(entry.Client, name)}";
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        }

        // ADD(含 Changes 的新定義)
        var adds = new List<CheckDto>();
        if (chk.Additions is not null) adds.AddRange(chk.Additions);
        if (chk.Changes is not null) adds.AddRange(chk.Changes);

        foreach (var a in adds)
        {
            if (string.IsNullOrEmpty(a.Clause)) continue;
            var named = !string.IsNullOrEmpty(a.Name) ? $"CONSTRAINT {QuoteIdent(entry.Client, a.Name)} " : string.Empty;
            var sql = $"ALTER TABLE {qualified} ADD {named}CHECK ({a.Clause})";
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        }
    }

    /// <summary>
    /// 套用 ADD COLUMN per-flavor.
    ///
    /// MySQL / Maria 支援單一 `ALTER TABLE x ADD COLUMN ..., ADD COLUMN ...` 多欄一次性;
    /// MSSQL `ALTER TABLE x ADD col1 def1, col2 def2`(沒有 COLUMN 關鍵字);
    /// PG 支援 `ALTER TABLE x ADD COLUMN ..., ADD COLUMN ...`;
    /// SQLite 必須 **每欄一條 ALTER TABLE**(不支援多 ADD COLUMN 串接).
    ///
    /// MSSQL 欄級註解必須 ALTER 跑完之後才執行 sp_addextendedproperty — 收進 postSqls.
    /// PG 欄級註解走 `COMMENT ON COLUMN ...` 也是 post-step.
    /// </summary>
    private static async Task ApplyAdditionsAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table,
        List<FieldDto> additions, CancellationToken ct)
    {
        // raw: ADD COLUMN carries unsigned/zerofill/auto_increment/comment/collation/
        // on-update/after/array/enum and expression-vs-literal defaults plus mysql/pg
        // batch multi-ADD. DbMaintenance.AddColumn renders only `ALTER ... ADD col
        // {type}{len}` from DbColumnInfo (no unsigned/zerofill/after/enum/collation/
        // expression-default fields) and would silently drop them — keep hand-rolled.
        if (string.IsNullOrEmpty(table) || additions.Count == 0) return;

        var qualified = QualifyTable(entry.Client, schema, table);
        var addClauses = new List<string>();
        var postSqls = new List<(string Sql, object? Params)>();

        foreach (var f in additions)
        {
            if (string.IsNullOrEmpty(f.Name) || string.IsNullOrEmpty(f.Type)) continue;
            addClauses.Add(RenderAddColumnClause(entry.Client, f));

            // post-step: column-level comment for mssql / pg
            if (!string.IsNullOrEmpty(f.Comment))
            {
                if (entry.Client == "mssql")
                {
                    postSqls.Add((@"
EXEC sp_addextendedproperty 'MS_Description', @v, 'SCHEMA', @sc, 'TABLE', @t, 'COLUMN', @c;",
                        new { sc = schema, t = table, c = f.Name, v = f.Comment }));
                }
                else if (entry.Client == "pg")
                {
                    var col = QuoteIdent(entry.Client, f.Name);
                    var esc = f.Comment.Replace("'", "''");
                    postSqls.Add(($"COMMENT ON COLUMN {qualified}.{col} IS '{esc}'", null));
                }
            }
        }

        if (addClauses.Count == 0) return;

        switch (entry.Client)
        {
            case "sqlite":
                // SQLite 不支援多 ADD COLUMN 串接,逐條跑.
                foreach (var clause in addClauses)
                {
                    var sql = $"ALTER TABLE {qualified} {clause}";
                    await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
                }
                break;
            default:
            {
                var sql = $"ALTER TABLE {qualified} {string.Join(", ", addClauses)}";
                await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
                break;
            }
        }

        foreach (var (sql, paramsObj) in postSqls)
        {
            await Task.Run(() => paramsObj is null
                ? entry.Db.Ado.ExecuteCommand(sql)
                : entry.Db.Ado.ExecuteCommand(sql, paramsObj), ct);
        }
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
        // raw: DbMaintenance.AddTableRemark on mssql is add-only (sp_addextendedproperty,
        // hardcoded N'dbo' schema) and throws if the description already exists; this
        // code does add-or-update via IF EXISTS and honours non-dbo schemas. mysql/pg
        // remarks are trivial but the mssql update path must be preserved — keep raw.
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
        // raw: SELECT INTO / CREATE TABLE LIKE / INCLUDING ALL is a multi-statement
        // per-flavor structure-clone with no DbMaintenance equivalent — SQL built by
        // TableDdl. The renderer sends only { uid, schema, table } (the source), so the
        // destination is derived as <table>_copy (the broken Source/Destination binding
        // — both were always empty — is fixed here; see DuplicateTablePayload).
        var entry = _registry.Require(p.Uid);
        if (string.IsNullOrEmpty(p.Table)) throw new ArgumentException("source table required");
        var destName = $"{p.Table}_copy";
        var src = QualifyTable(entry.Client, p.Schema, p.Table);
        var dst = QualifyTable(entry.Client, p.Schema, destName);
        var stmts = RenderDuplicate(entry.Client, src, dst, p.CopyData);
        if (stmts.Count == 0) throw new NotSupportedException($"duplicate not supported for {entry.Client}");
        foreach (var sql in stmts)
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/truncate"), NonUnify]
    public async Task<object> Truncate([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        // SqlSugar DbMaintenance.TruncateTable emits `TRUNCATE TABLE <q>` on
        // mssql/mysql/maria/pg and falls back to `DELETE FROM <q>` (+ an
        // `UPDATE sqlite_sequence SET seq=0` to reset autoincrement) on sqlite,
        // which has no TRUNCATE — so the per-flavor switch is now built in. The
        // sqlite_sequence reset is new vs the old bare DELETE but is the correct
        // TRUNCATE semantics. Identifiers quoted per dialect (Gate-1).
        var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";
        await Task.Run(() => entry.Db.DbMaintenance.TruncateTable(table), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/drop"), NonUnify]
    public async Task<object> Drop([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        // SqlSugar DbMaintenance.DropTable emits `DROP TABLE <q>` on every dialect
        // (identical to the old hand-rolled SQL) and quotes schema+table itself per
        // flavor (Gate-1: mssql [User], mysql/sqlite backtick, pg lowercased "user").
        var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";
        await Task.Run(() => entry.Db.DbMaintenance.DropTable(table), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/tables/updateCell"), NonUnify]
    public async Task<object> UpdateCell([FromBody] UpdateCellPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";

        if (p.Primary is null || p.Primary.Count == 0)
            throw new ArgumentException("primary key cell identifier required");

        // SqlSugar entity-less Update: the dict carries BOTH the SET column and the
        // key columns; WhereColumns(keyCols) marks the keys as the WHERE predicate
        // (and excludes them from SET). SqlSugar quotes every identifier per dialect,
        // so no hand-rolled QualifyTable/QuoteIdent is needed here (Gate-1 proven).
        var dict = new Dictionary<string, object?>
        {
            [p.Column ?? string.Empty] = Antares.Server.Infrastructure.JsonValue.Unwrap(p.Value)
        };
        var keyCols = p.Primary.Keys.ToArray();
        foreach (var kv in p.Primary)
            dict[kv.Key] = Antares.Server.Infrastructure.JsonValue.Unwrap(kv.Value);

        await Task.Run(() => entry.Db.Updateable(dict).AS(table).WhereColumns(keyCols).ExecuteCommand(), ct);
        // Renderer (useResultTables.ts:updateField) reads `response.reload`:
        // false → applyUpdate() patches the cell in-place, true → full reload
        // (legacy Node did this for blob fields). Without a `response` object the
        // renderer throws "Cannot read properties of undefined (reading 'reload')",
        // shows an error toast, and skips applyUpdate — so every cell edit looked
        // like it failed even though the UPDATE committed. reload=false is correct
        // for scalar cells; blob-aware reload can be added later if needed.
        return new { status = "success", response = new { reload = false } };
    }

    [HttpPost("/api/tables/deleteRows"), NonUnify]
    public async Task<object> DeleteRows([FromBody] DeleteRowsPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";
        if (p.Rows is null || p.Rows.Count == 0) return new { status = "success", response = new { affectedRows = 0L } };

        long affected = 0;
        foreach (var row in p.Rows)
        {
            // Build a per-row AND of (keyCol = value) conditionals. SqlSugar's
            // entity-less Deleteable<object>().Where(List<IConditionalModel>) quotes
            // each identifier per dialect (Gate-1 proven for the reserved word "User").
            var conds = new List<IConditionalModel>();
            foreach (var kv in row)
                conds.Add(BuildKeyConditional(kv.Key, Antares.Server.Infrastructure.JsonValue.Unwrap(kv.Value)));
            affected += await Task.Run(
                () => entry.Db.Deleteable<object>().AS(table).Where(conds).ExecuteCommand(), ct);
        }
        return new { status = "success", response = new { affectedRows = affected } };
    }

    [HttpPost("/api/tables/insertFakeRows"), NonUnify]
    public async Task<object> InsertFakeRows([FromBody] InsertFakeRowsPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";
        var faker = new Faker();
        var inserted = 0;
        var repeat = Math.Max(1, p.Repeat);
        var row = p.Row ?? new Dictionary<string, FakeCellDto>();
        var fields = p.Fields ?? new Dictionary<string, string>();
        for (var n = 0; n < repeat; n++)
        {
            ct.ThrowIfCancellationRequested();
            var values = new Dictionary<string, object?>();
            foreach (var kv in row)
            {
                var cell = kv.Value;
                // group 'manual' → use the literal value the user typed into the
                // add-row UI; any other group is a faker semantic → generate one
                // (fields[col] carries the column data type for type-aware fakes).
                if (string.Equals(cell?.Group, "manual", StringComparison.OrdinalIgnoreCase))
                    values[kv.Key] = Antares.Server.Infrastructure.JsonValue.Unwrap(cell?.Value);
                else
                {
                    fields.TryGetValue(kv.Key, out var dataType);
                    values[kv.Key] = GenerateFake(faker, cell?.Group, dataType);
                }
            }
            if (values.Count == 0) break;
            // SqlSugar entity-less Insert: dict col→value, AS(table) for the target.
            // Identifiers are quoted per dialect (Gate-1 proven).
            await Task.Run(() => entry.Db.Insertable(values).AS(table).ExecuteCommand(), ct);
            inserted += 1;
        }
        return new { status = "success", response = new { affectedRows = inserted } };
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

    // Build a (keyCol = value) conditional for DeleteRows that PRESERVES the value's
    // CLR type. ConditionalModel.FieldValue is a string, so without CSharpTypeName
    // SqlSugar emits a String/text parameter — fine on mysql/sqlite/mssql (implicit
    // cast), but Postgres rejects `integer = text` at runtime. Setting CSharpTypeName
    // makes SqlSugar bind a typed parameter (verified offline: "long" -> DbType.Int64).
    // `value` is already JsonValue.Unwrap'd (long/double/bool/string/null).
    // Date/Guid PKs arrive from JSON as strings (no type info) and stay text — best
    // effort; the common integer-PK case is the one this fixes.
    internal static IConditionalModel BuildKeyConditional(string field, object? value)
    {
        if (value is null)
            return new ConditionalModel { FieldName = field, ConditionalType = ConditionalType.EqualNull, FieldValue = null };

        var inv = System.Globalization.CultureInfo.InvariantCulture;
        var (text, type) = value switch
        {
            bool b => (b ? "true" : "false", "bool"),
            long l => (l.ToString(inv), "long"),
            int i => (i.ToString(inv), "int"),
            double d => (d.ToString(inv), "double"),
            decimal m => (m.ToString(inv), "decimal"),
            _ => (value.ToString() ?? string.Empty, "string")
        };
        return new ConditionalModel
        {
            FieldName = field,
            ConditionalType = ConditionalType.Equal,
            FieldValue = text,
            CSharpTypeName = type
        };
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
    public List<FieldDto>? Additions { get; set; }
    public List<FieldDto>? Changes { get; set; }
    public List<FieldDto>? Deletions { get; set; }
    public IndexChangesDto? IndexChanges { get; set; }
    public ForeignChangesDto? ForeignChanges { get; set; }
    public CheckChangesDto? CheckChanges { get; set; }
    /// <summary>表級選項 diff,key 包含 `comment`/`name`/`collation`/`engine`/`autoIncrement` 等.</summary>
    public Dictionary<string, object?>? Options { get; set; }
}

/// <summary>對應 web/common/interfaces/antares.ts TableField — renderer 送的欄位 shape.</summary>
public sealed class FieldDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? OrgName { get; set; }
    public bool? Nullable { get; set; }
    public bool? Unsigned { get; set; }
    public bool? Zerofill { get; set; }
    public bool? AutoIncrement { get; set; }
    public bool? IsArray { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? Length { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? NumLength { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? CharLength { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? DatePrecision { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? NumPrecision { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrIntConverter))]
    public int? NumScale { get; set; }
    public string? Default { get; set; }
    public string? DefaultType { get; set; }
    public string? Comment { get; set; }
    public string? Collation { get; set; }
    public string? Charset { get; set; }
    public string? OnUpdate { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(BoolOrStringConverter))]
    public string? After { get; set; }
    public string? EnumValues { get; set; }
    public string? Key { get; set; }
}

public sealed class TableStructureDto
{
    public string? Name { get; set; }
    public List<FieldDto>? Fields { get; set; }
    public List<Dictionary<string, object?>>? Foreigns { get; set; }
    public List<Dictionary<string, object?>>? Indexes { get; set; }
}

public sealed class IndexChangesDto
{
    public List<IndexDto>? Additions { get; set; }
    public List<IndexDto>? Changes { get; set; }
    public List<IndexDto>? Deletions { get; set; }
}

public sealed class ForeignChangesDto
{
    public List<ForeignDto>? Additions { get; set; }
    public List<ForeignDto>? Changes { get; set; }
    public List<ForeignDto>? Deletions { get; set; }
}

public sealed class CheckChangesDto
{
    public List<CheckDto>? Additions { get; set; }
    public List<CheckDto>? Changes { get; set; }
    public List<CheckDto>? Deletions { get; set; }
}

/// <summary>對應 antares.ts TableIndex.</summary>
public sealed class IndexDto
{
    public string Name { get; set; } = string.Empty;
    public List<string> Fields { get; set; } = new();
    public string Type { get; set; } = string.Empty;
    public string? OldName { get; set; }
    public string? OldType { get; set; }
}

/// <summary>對應 antares.ts TableForeign.</summary>
public sealed class ForeignDto
{
    public string ConstraintName { get; set; } = string.Empty;
    public string? OldName { get; set; }
    public string Field { get; set; } = string.Empty;
    public string RefTable { get; set; } = string.Empty;
    public string RefField { get; set; } = string.Empty;
    public string? RefSchema { get; set; }
    public string? OnUpdate { get; set; }
    public string? OnDelete { get; set; }
}

/// <summary>對應 antares.ts TableCheck.</summary>
public sealed class CheckDto
{
    public string Name { get; set; } = string.Empty;
    public string Clause { get; set; } = string.Empty;
}

// Renderer sends only { uid, schema, table } (the SOURCE table) — see
// web/renderer/ipc-api/Tables.ts:duplicateTable + WorkspaceExploreBar.vue. The old
// DTO bound Source/Destination/CopyData, none of which the renderer sends, so both
// names were always empty and duplicate produced `CREATE TABLE "" LIKE ""`. Bind the
// real contract (TableTargetPayload = Uid/Schema/Table) and derive <table>_copy as the
// destination in Duplicate(). CopyData defaults true (not sent by the renderer today).
public sealed class DuplicateTablePayload : TableTargetPayload
{
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
    // Renderer (Tables.ts:insertTableFakeRows + ModalFakerRows.vue, the add-row UI)
    // sends the legacy Node contract: per-column { group, value }, a repeat count,
    // a column→datatype map, and a locale. The original .NET DTO bound Count/Columns
    // which the renderer never sends, so p.Columns was always null → zero rows
    // inserted while still returning success (the "add row does nothing" bug).
    public Dictionary<string, FakeCellDto>? Row { get; set; }
    public int Repeat { get; set; } = 1;
    public Dictionary<string, string>? Fields { get; set; }
    public string? Locale { get; set; }
}

public sealed class FakeCellDto
{
    public string? Group { get; set; }
    public object? Value { get; set; }
}

/// <summary>
/// Renderer 的 TableField interface 對 length / numLength / charLength 等欄位的型別是
/// `number | false` — `false` 是「沒有長度」的 sentinel(antares.ts:78-110).Plain
/// `int?` 反序列化會拒絕 bool,造成 400 model-binding error.這個 converter 接受
/// number/null/false 三種輸入,後兩者都映射為 null.
/// </summary>
internal sealed class BoolOrIntConverter : System.Text.Json.Serialization.JsonConverter<int?>
{
    public override int? Read(ref System.Text.Json.Utf8JsonReader reader,
        Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case System.Text.Json.JsonTokenType.Null:
            case System.Text.Json.JsonTokenType.False:
            case System.Text.Json.JsonTokenType.True:
                return null;
            case System.Text.Json.JsonTokenType.Number:
                return reader.TryGetInt32(out var v) ? v : (int?)null;
            case System.Text.Json.JsonTokenType.String:
                // 部分 sentinel 值會以字串形式出現(空字串).
                var s = reader.GetString();
                return int.TryParse(s, out var n) ? n : (int?)null;
            default:
                throw new System.Text.Json.JsonException(
                    $"BoolOrIntConverter cannot read TokenType={reader.TokenType}");
        }
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, int? value,
        System.Text.Json.JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteNumberValue(value.Value);
        else writer.WriteNullValue();
    }
}

/// <summary>
/// Renderer 的 TableField.after 是 `string | false` 型別 — `false` 表「插在最前」(FIRST).
/// `string?` 反序列化會拒絕 bool,造成 400.這個 converter 接受 string/null/bool,後二者
/// 映射為 null(代表「沒有 after,放在最前」由 ApplyAdditionsAsync 自行決定).
/// </summary>
internal sealed class BoolOrStringConverter : System.Text.Json.Serialization.JsonConverter<string?>
{
    public override string? Read(ref System.Text.Json.Utf8JsonReader reader,
        Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            System.Text.Json.JsonTokenType.Null => null,
            System.Text.Json.JsonTokenType.False => null,
            System.Text.Json.JsonTokenType.True => null,
            System.Text.Json.JsonTokenType.String => reader.GetString(),
            System.Text.Json.JsonTokenType.Number => reader.TryGetInt64(out var n) ? n.ToString() : null,
            _ => throw new System.Text.Json.JsonException($"BoolOrStringConverter cannot read TokenType={reader.TokenType}")
        };
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, string? value,
        System.Text.Json.JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(value);
    }
}
