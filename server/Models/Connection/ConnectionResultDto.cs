using System.Text.Json.Serialization;

namespace Antares.Server.Models.Connection;

/// <summary>
/// Response shape for /api/connection/connect — array of schemas, each with its
/// tables / views / functions / procedures / triggers / triggerFunctions / schedulers.
/// Matches the renderer's expected envelope payload (see fixtures captured under
/// tests/fixtures/contract/connection.connect.*.happy.json).
/// </summary>
public sealed class SchemaInfoDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("tables")]
    public List<TableSummaryDto> Tables { get; set; } = new();

    [JsonPropertyName("functions")]
    public List<RoutineSummaryDto> Functions { get; set; } = new();

    [JsonPropertyName("procedures")]
    public List<RoutineSummaryDto> Procedures { get; set; } = new();

    [JsonPropertyName("triggers")]
    public List<TriggerSummaryDto> Triggers { get; set; } = new();

    [JsonPropertyName("triggerFunctions")]
    public List<RoutineSummaryDto> TriggerFunctions { get; set; } = new();

    [JsonPropertyName("schedulers")]
    public List<SchedulerSummaryDto> Schedulers { get; set; } = new();
}

public sealed class TableSummaryDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>One of: "table", "view".</summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = "table";

    [JsonPropertyName("rows")]
    public long Rows { get; set; }

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("collation")]
    public string Collation { get; set; } = string.Empty;

    [JsonPropertyName("comment")]
    public string Comment { get; set; } = string.Empty;

    [JsonPropertyName("engine")]
    public string Engine { get; set; } = string.Empty;
}

public sealed class RoutineSummaryDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public sealed class TriggerSummaryDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("table")]
    public string? Table { get; set; }
}

public sealed class SchedulerSummaryDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
