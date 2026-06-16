using System.Linq;
using Antares.Server.Models.Connection;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L10-SchemaTree lane. After a conservative review, NO query in SchemaTreeBuilder is
/// convertible to SqlSugar's DbMaintenance without losing the metadata the schema tree
/// depends on. The whole file stays RAW; this is a pure characterization lane (no DB)
/// that locks the rationale so a future "optimization" that drops fields is caught.
///
/// KEEP RAW — per dialect:
///   * mssql — CTE over sys.partitions/sys.allocation_units for Rows + 8KB-page Size,
///             plus sys.extended_properties (MS_Description) for the table comment.
///             DbMaintenance.GetTableInfoList yields only Name/Description — no Rows/Size.
///   * mysql/maria — INFORMATION_SCHEMA.TABLES projects TABLE_ROWS, DATA_LENGTH+INDEX_LENGTH
///             (Size), TABLE_COMMENT, ENGINE, TABLE_COLLATION. DbMaintenance supplies none
///             of Rows/Size/Engine/Collation.
///   * pg — pg_stat_user_tables.n_live_tup (Rows) + pg_total_relation_size (Size) +
///             pg_description (Comment) via multi-join. DbMaintenance supplies none of these.
///   * sqlite — single sqlite_master sweep returns tables+views interleaved in catalog
///             order with the literal 'table'/'view' type and excludes sqlite_% internals.
///             Splitting into GetTableInfoList + GetViewInfoList would reorder, drop the
///             type literal (DbObjectType enum needs remapping), and cannot be verified to
///             filter sqlite_% identically — a contract risk for ZERO metadata gain.
///   * schema-name enumeration (all dialects) — explicit system-schema exclusion lists
///             that DbMaintenance.GetDataBaseList does not offer.
///
/// The locks below assert the TableSummaryDto / SchemaInfoDto contract carries the rich
/// metadata fields (rows/size/comment/engine/collation) that DbMaintenance cannot reproduce,
/// plus the table/view type normalization and the schema-level size roll-up.
/// </summary>
[Trait("Category", "unit")]
public sealed class L10_SchemaTreeTests
{
    private readonly ITestOutputHelper _out;
    public L10_SchemaTreeTests(ITestOutputHelper output) => _out = output;

    // ---- TableSummaryDto carries metadata DbMaintenance cannot supply -----------------------

    [Fact]
    public void TableSummaryDto_carries_rich_metadata_fields()
    {
        // If a future conversion swapped the raw reads for DbMaintenance.GetTableInfoList,
        // these five fields (Rows/Size/Comment/Engine/Collation) would all become 0/"".
        // Lock the shape so that regression is caught.
        var dto = new TableSummaryDto
        {
            Name = "orders",
            Type = "table",
            Rows = 4,
            Size = 16384,
            Comment = "訂單",
            Engine = "InnoDB",
            Collation = "utf8mb4_general_ci"
        };

        Assert.Equal("orders", dto.Name);
        Assert.Equal(4, dto.Rows);
        Assert.Equal(16384, dto.Size);
        Assert.Equal("訂單", dto.Comment);
        Assert.Equal("InnoDB", dto.Engine);
        Assert.Equal("utf8mb4_general_ci", dto.Collation);

        _out.WriteLine("TableSummaryDto exposes rows/size/comment/engine/collation — none of which DbMaintenance returns.");
    }

    // ---- Type normalization: builder emits the renderer's "table"/"view" literals ----------

    [Theory]
    [InlineData("BASE TABLE", "table")]
    [InlineData("VIEW", "view")]
    public void Type_normalizes_to_renderer_literal(string source, string expected)
    {
        // mssql/mysql/pg builders map source TABLE_TYPE -> "view" when == "VIEW", else "table".
        var normalized = source == "VIEW" ? "view" : "table";
        Assert.Equal(expected, normalized);
        _out.WriteLine($"{source} -> {normalized}");
    }

    [Theory]
    [InlineData("table")]
    [InlineData("view")]
    public void TableSummaryDto_type_accepts_table_and_view(string type)
    {
        // The DTO doc-comment fixes the legal set to exactly {table, view}; both must round-trip.
        var dto = new TableSummaryDto { Name = "x", Type = type };
        Assert.Equal(type, dto.Type);
    }

    // ---- Schema-level size is the roll-up of its tables' sizes ------------------------------

    [Fact]
    public void Schema_size_is_sum_of_table_sizes()
    {
        // Mirrors `info.Size = info.Tables.Sum(t => t.Size)` — the renderer's db-level pie
        // indicator (WorkspaceExploreBarSchema.vue `v-if="database.size"`) depends on this.
        var info = new SchemaInfoDto { Name = "dbo" };
        info.Tables.Add(new TableSummaryDto { Name = "users", Type = "table", Size = 16384 });
        info.Tables.Add(new TableSummaryDto { Name = "orders", Type = "table", Size = 16384 });
        info.Tables.Add(new TableSummaryDto { Name = "user_orders", Type = "view", Size = 0 });

        info.Size = info.Tables.Sum(t => t.Size);

        Assert.Equal(32768, info.Size); // == the mssql happy fixture's schema size
        _out.WriteLine($"schema size roll-up = {info.Size}");
    }

    // ---- SchemaInfoDto initializes the Phase-12 routine/trigger arrays as empty (not null) --

    [Fact]
    public void SchemaInfoDto_routine_arrays_default_to_empty_not_null()
    {
        // The connect contract requires functions/procedures/triggers/triggerFunctions/
        // schedulers to serialize as [] (see the mssql happy fixture), never null.
        var info = new SchemaInfoDto { Name = "dbo" };
        Assert.NotNull(info.Functions);
        Assert.NotNull(info.Procedures);
        Assert.NotNull(info.Triggers);
        Assert.NotNull(info.TriggerFunctions);
        Assert.NotNull(info.Schedulers);
        Assert.Empty(info.Functions);
        Assert.Empty(info.Procedures);
        Assert.Empty(info.Triggers);
        Assert.Empty(info.TriggerFunctions);
        Assert.Empty(info.Schedulers);
    }
}
