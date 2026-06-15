namespace Antares.Server.Tables;

/// <summary>
/// Pure-function, per-dialect SQL renderers for table-structure DDL
/// (CREATE / ALTER column / index / identifier quoting). Extracted from
/// <see cref="TablesWriteService"/> so the SQL string construction is unit-testable
/// in isolation (offline, no DB) and the service is left as thin orchestration.
///
/// Why these stay hand-rolled rather than SqlSugar DbMaintenance/CodeFirst: an
/// empirical probe (2026-06) confirmed SqlSugar 5.1.4.214's DDL generators are
/// strictly weaker here — they silently drop DEFAULT values, COMMENT, UNSIGNED,
/// COLLATE and decimal scale, break SQLite ALTER, and leave reserved-word columns
/// unquoted in named indexes/PKs. See
/// docs/net-migration/2026-06-12-sqlsugar-conversion-outcome.md.
///
/// All members are <c>internal static</c>; tests reach them via
/// <c>[InternalsVisibleTo("Server.IntegrationTests")]</c> (server/AssemblyInfo.cs).
/// </summary>
internal static class TableDdl
{
    // ---- identifier quoting -------------------------------------------------

    /// <summary>Schema-qualified, dialect-quoted table name. sqlite ignores schema.</summary>
    internal static string QualifyTable(string client, string? schema, string? table)
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

    /// <summary>Single dialect-quoted identifier.</summary>
    internal static string QuoteIdent(string client, string name) => client switch
    {
        "mssql" => $"[{Sanitize(name)}]",
        "mysql" or "maria" => $"`{Sanitize(name)}`",
        "pg" => $"\"{Sanitize(name)}\"",
        _ => $"\"{Sanitize(name)}\""
    };

    /// <summary>
    /// Denylist strip of quote/terminator chars before embedding an identifier in a
    /// SQL string. NOT parameterization — values (defaults, comments) escape via
    /// `Replace("'", "''")` separately.
    /// </summary>
    internal static string Sanitize(string s) =>
        s.Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "").Replace("--", "");

    // ---- CREATE TABLE column ------------------------------------------------

    internal static string RenderColumn(string client, NewColumnDef c)
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

    // ---- ALTER: ADD COLUMN clause ------------------------------------------

    /// <summary>
    /// Renders a single ADD COLUMN clause (no leading `ALTER TABLE x`). Per-flavor
    /// keyword / ordering / modifiers:
    ///   mssql:  ADD [name] TYPE(len)        IDENTITY(1,1) NULL|NOT NULL DEFAULT v
    ///   mysql:  ADD COLUMN `name` TYPE(len) UNSIGNED ZEROFILL NULL|NOT NULL AUTO_INCREMENT DEFAULT v COMMENT '...' COLLATE x AFTER `c`
    ///   pg:     ADD COLUMN "name" TYPE(len) NULL|NOT NULL DEFAULT v
    ///   sqlite: ADD COLUMN "name" TYPE(len) NULL|NOT NULL DEFAULT v
    /// </summary>
    internal static string RenderAddColumnClause(string client, FieldDto f)
    {
        var name = QuoteIdent(client, f.Name);
        var typeUpper = f.Type.ToUpperInvariant();
        var lengthSpec = BuildLengthSpec(f);

        return client switch
        {
            "mssql" => $"ADD {name} {typeUpper}{lengthSpec}"
                + (f.AutoIncrement == true ? " IDENTITY(1,1)" : string.Empty)
                + (f.Nullable == false ? " NOT NULL" : " NULL")
                + RenderDefault(f),

            "mysql" or "maria" => $"ADD COLUMN {name} {typeUpper}{lengthSpec}"
                + (f.Unsigned == true ? " UNSIGNED" : string.Empty)
                + (f.Zerofill == true ? " ZEROFILL" : string.Empty)
                + (f.Nullable == false ? " NOT NULL" : " NULL")
                + (f.AutoIncrement == true ? " AUTO_INCREMENT" : string.Empty)
                + RenderDefault(f)
                + (!string.IsNullOrEmpty(f.Comment) ? $" COMMENT '{f.Comment.Replace("'", "''")}'" : string.Empty)
                + (!string.IsNullOrEmpty(f.Collation) ? $" COLLATE {f.Collation}" : string.Empty)
                + (!string.IsNullOrEmpty(f.OnUpdate) ? $" ON UPDATE {f.OnUpdate}" : string.Empty)
                + (!string.IsNullOrEmpty(f.After) ? $" AFTER `{Sanitize(f.After)}`" : string.Empty),

            "pg" => $"ADD COLUMN {name} {typeUpper}{lengthSpec}"
                + (f.IsArray == true ? "[]" : string.Empty)
                + (f.Nullable == false ? " NOT NULL" : string.Empty)
                + RenderDefault(f),

            _ => $"ADD COLUMN {name} {typeUpper}{lengthSpec}"
                + (f.Nullable == false ? " NOT NULL" : string.Empty)
                + RenderDefault(f),
        };
    }

    /// <summary>
    /// Length/precision spec: `(255)`, `(10,2)`, or `('a','b')` for ENUM/SET.
    /// Picks the first non-empty of enumValues / numLength / charLength /
    /// datePrecision / length.
    /// </summary>
    internal static string BuildLengthSpec(FieldDto f)
    {
        if (!string.IsNullOrEmpty(f.EnumValues))
            return $"({f.EnumValues})";

        var len = f.NumLength ?? f.CharLength ?? f.DatePrecision ?? f.Length;
        if (len is null || len <= 0) return string.Empty;

        return f.NumScale is > 0 ? $"({len},{f.NumScale})" : $"({len})";
    }

    /// <summary>
    /// DEFAULT clause. `null` → no clause; `defaultType == "expression"` → unquoted;
    /// otherwise a single-quote-escaped literal. Inlined (not parameterized) because
    /// ALTER TABLE cannot parameterize column defaults.
    /// </summary>
    internal static string RenderDefault(FieldDto f)
    {
        if (f.Default is null) return string.Empty;
        if (string.Equals(f.DefaultType, "expression", StringComparison.OrdinalIgnoreCase))
            return $" DEFAULT {f.Default}";
        var esc = f.Default.Replace("'", "''");
        return $" DEFAULT '{esc}'";
    }

    // ---- ALTER: ADD INDEX ---------------------------------------------------

    internal static string RenderAddIndexSql(string client, string qualified, IndexDto idx)
    {
        var fields = string.Join(",", idx.Fields.Select(f => QuoteIdent(client, f)));
        return client switch
        {
            "mysql" or "maria" => idx.Type == "PRIMARY"
                ? $"ALTER TABLE {qualified} ADD PRIMARY KEY ({fields})"
                : idx.Type == "UNIQUE"
                    ? $"ALTER TABLE {qualified} ADD UNIQUE INDEX `{Sanitize(idx.Name)}` ({fields})"
                    : $"ALTER TABLE {qualified} ADD INDEX `{Sanitize(idx.Name)}` ({fields})",
            "mssql" => idx.Type == "PRIMARY"
                ? $"ALTER TABLE {qualified} ADD CONSTRAINT [{Sanitize(idx.Name)}] PRIMARY KEY ({fields})"
                : idx.Type == "UNIQUE"
                    ? $"CREATE UNIQUE INDEX [{Sanitize(idx.Name)}] ON {qualified} ({fields})"
                    : $"CREATE INDEX [{Sanitize(idx.Name)}] ON {qualified} ({fields})",
            "pg" => idx.Type == "PRIMARY"
                ? $"ALTER TABLE {qualified} ADD CONSTRAINT \"{Sanitize(idx.Name)}\" PRIMARY KEY ({fields})"
                : idx.Type == "UNIQUE"
                    ? $"CREATE UNIQUE INDEX \"{Sanitize(idx.Name)}\" ON {qualified} ({fields})"
                    : $"CREATE INDEX \"{Sanitize(idx.Name)}\" ON {qualified} ({fields})",
            "sqlite" => idx.Type == "UNIQUE"
                ? $"CREATE UNIQUE INDEX \"{Sanitize(idx.Name)}\" ON {qualified} ({fields})"
                : $"CREATE INDEX \"{Sanitize(idx.Name)}\" ON {qualified} ({fields})",
            _ => string.Empty
        };
    }
}
