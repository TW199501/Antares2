using System.Text.Json;
using Antares.Server.Triggers;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L4-Triggers lane: this lane is a FIX lane, not a conversion lane. Every endpoint in
/// TriggersService stays RAW (no DbMaintenance API for trigger CREATE/ALTER/DROP/ENABLE,
/// and GetTriggerNames returns List&lt;string&gt; only — cannot fill TriggerInfoDto.Table_/Sql).
///
/// The bug these tests guard is DTO-CONTRACT-DRIFT (the class CLAUDE.md warns about):
/// the renderer (Triggers.ts + WorkspaceTabPropsTrigger.vue + WorkspaceExploreBarMiscContext.vue)
/// ships payload shapes the .NET DTOs did not bind:
///   * alter  -> NESTED  { uid, trigger: { name, sql, schema, oldName, table } }  (was bound flat)
///   * drop   -> name under key `trigger`: { uid, schema, trigger: name }          (DTO had only Name)
///   * toggle -> name under key `trigger`: { uid, schema, trigger: name, enabled } (DTO had only Name)
///
/// These tests deserialize the EXACT renderer JSON with the same case-insensitive
/// System.Text.Json semantics ASP.NET Core uses, then assert the resolved name / SQL.
/// No live DB: the SQL builders are pure functions of the bound DTO.
/// </summary>
[Trait("Category", "unit")]
public sealed class L4_TriggersTests
{
    private readonly ITestOutputHelper _out;
    public L4_TriggersTests(ITestOutputHelper output) => _out = output;

    // ASP.NET Core's default JSON binding is case-insensitive; mirror it here.
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };

    private static T Bind<T>(string json) => JsonSerializer.Deserialize<T>(json, Opts)!;

    // ---- alter: nested { uid, trigger: {...} } now binds (was the empty-DROP bug) ----

    [Fact]
    public void Alter_binds_nested_trigger_payload_from_renderer()
    {
        // Mirrors WorkspaceTabPropsTrigger.vue:256 saveChanges() shape.
        const string json = """
        {
          "uid": "c1",
          "trigger": {
            "name": "newName",
            "sql": "CREATE TRIGGER newName ...",
            "schema": "public",
            "oldName": "oldName",
            "table": "orders"
          }
        }
        """;

        var p = Bind<TriggersService.TriggerAlterPayload>(json);

        Assert.Equal("c1", p.Uid);
        Assert.NotNull(p.Trigger);
        Assert.Equal("newName", p.Trigger!.Name);
        Assert.Equal("CREATE TRIGGER newName ...", p.Trigger.Sql);
        Assert.Equal("oldName", p.Trigger.OldName);
        Assert.Equal("orders", p.Trigger.Table);
        _out.WriteLine($"alter bound: name={p.Trigger.Name} sql.len={p.Trigger.Sql.Length} oldName={p.Trigger.OldName}");
    }

    [Fact]
    public void Alter_drop_targets_oldName_so_rename_works()
    {
        const string json = """
        { "uid": "c1", "trigger": { "name": "newName", "sql": "X", "oldName": "oldName" } }
        """;
        var p = Bind<TriggersService.TriggerAlterPayload>(json);
        var t = p.Trigger!;
        var oldName = !string.IsNullOrEmpty(t.OldName) ? t.OldName! : t.Name;
        Assert.Equal("oldName", oldName); // DROP the original, not the new name
    }

    [Fact]
    public void Alter_drop_falls_back_to_name_when_oldName_absent()
    {
        const string json = """ { "uid": "c1", "trigger": { "name": "trg", "sql": "X" } } """;
        var p = Bind<TriggersService.TriggerAlterPayload>(json);
        var t = p.Trigger!;
        var oldName = !string.IsNullOrEmpty(t.OldName) ? t.OldName! : t.Name;
        Assert.Equal("trg", oldName);
    }

    // ---- drop: name arrives under key `trigger` --------------------------------------

    [Fact]
    public void Drop_resolves_name_from_trigger_key()
    {
        // Mirrors WorkspaceExploreBarMiscContext.vue:181 dropTrigger() shape.
        const string json = """ { "uid": "c1", "schema": "public", "trigger": "my_trigger" } """;
        var p = Bind<TriggersService.TriggerDdlPayload>(json);
        Assert.Equal("my_trigger", p.ResolvedName);
        Assert.Equal(string.Empty, p.Name); // the flat `name` key is genuinely absent on the wire
    }

    [Fact]
    public void Drop_still_resolves_flat_name_for_backward_compat()
    {
        const string json = """ { "uid": "c1", "schema": "public", "name": "flat_trigger" } """;
        var p = Bind<TriggersService.TriggerDdlPayload>(json);
        Assert.Equal("flat_trigger", p.ResolvedName);
    }

    // ---- create: still binds the FLAT renderer shape (no regression) -----------------

    [Fact]
    public void Create_binds_flat_payload_from_renderer()
    {
        // Mirrors WorkspaceTabNewTrigger.vue:216 createTrigger() shape: { uid, schema, ...localTrigger }.
        const string json = """
        { "uid": "c1", "schema": "public", "name": "trg", "sql": "CREATE TRIGGER trg ...", "table": "orders" }
        """;
        var p = Bind<TriggersService.TriggerDdlPayload>(json);
        Assert.Equal("trg", p.Name);
        Assert.Equal("trg", p.ResolvedName);
        Assert.Equal("CREATE TRIGGER trg ...", p.Sql);
    }

    // ---- toggle: name arrives under key `trigger`; PG composite split -----------------

    [Fact]
    public void Toggle_resolves_name_from_trigger_key()
    {
        // Mirrors WorkspaceExploreBarMiscContext.vue:361 toggleTrigger() shape.
        const string json = """ { "uid": "c1", "schema": "dbo", "trigger": "trg", "enabled": true } """;
        var p = Bind<TriggersService.TriggerToggleDto>(json);
        Assert.Equal("trg", p.ResolvedName);
    }

    [Theory]
    [InlineData(true, "ENABLE TRIGGER [trg] ON [orders]")]
    [InlineData(false, "DISABLE TRIGGER [trg] ON [orders]")]
    public void Toggle_mssql_emits_enable_disable_with_table(bool enabled, string expected)
    {
        // MSSQL has triggerTableInName=false; the renderer toggle payload carries NO table, so a
        // correct ON <table> requires Table to be supplied. Here we supply it to lock the SQL shape.
        var p = new TriggersService.TriggerToggleDto { Trigger = "trg", Table = "orders", Schema = "dbo", Enabled = enabled };
        Assert.Equal(expected, TriggersService.BuildToggleSql("mssql", p));
    }

    [Fact]
    public void Toggle_mssql_table_empty_when_renderer_omits_it()
    {
        // Document the renderer gap: WorkspaceExploreBarMiscContext.vue:361 sends no `table`, and
        // selectedMisc has no table field, so ON [] is empty for MSSQL. Out of this lane's edit scope
        // (renderer-side); locked here so a future renderer fix is detected.
        const string json = """ { "uid": "c1", "schema": "dbo", "trigger": "trg", "enabled": true } """;
        var p = Bind<TriggersService.TriggerToggleDto>(json);
        Assert.Equal("ENABLE TRIGGER [trg] ON []", TriggersService.BuildToggleSql("mssql", p));
    }

    [Theory]
    [InlineData(true, "ALTER TABLE \"public\".\"orders\" ENABLE TRIGGER \"trg\"")]
    [InlineData(false, "ALTER TABLE \"public\".\"orders\" DISABLE TRIGGER \"trg\"")]
    public void Toggle_pg_splits_table_dot_name_composite(bool enabled, string expected)
    {
        // PG has triggerTableInName=true; the renderer ships the name as `table.name` (orders.trg).
        var p = new TriggersService.TriggerToggleDto { Trigger = "orders.trg", Schema = "public", Enabled = enabled };
        Assert.Equal(expected, TriggersService.BuildToggleSql("pg", p));
    }

    [Fact]
    public void Toggle_non_mssql_pg_clients_are_noop()
    {
        var p = new TriggersService.TriggerToggleDto { Trigger = "trg", Enabled = true };
        Assert.Equal(string.Empty, TriggersService.BuildToggleSql("mysql", p));
        Assert.Equal(string.Empty, TriggersService.BuildToggleSql("sqlite", p));
    }

    // ---- guard: identifier sanitizer still strips injection chars ---------------------

    [Fact]
    public void Toggle_sanitizes_identifier_chars()
    {
        var p = new TriggersService.TriggerToggleDto { Trigger = "tr]g;", Table = "or`ders", Schema = "db\"o", Enabled = true };
        var sql = TriggersService.BuildToggleSql("mssql", p);
        _out.WriteLine(sql);
        Assert.DoesNotContain(";", sql);
        Assert.DoesNotContain("]g", sql); // the stray ] inside the name was stripped
    }
}
