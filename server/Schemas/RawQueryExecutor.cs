using System.Data;
using System.Diagnostics;
using SqlSugar;

namespace Antares.Server.Schemas;

/// <summary>
/// Executes ad-hoc SQL submitted by the renderer's query tab.
/// Returns the rowset(s) + metadata fields the renderer expects:
///   { rows: [...], fields: [...], report: { duration, rowsAffected }, ... }
///
/// Phase 7 baseline: one statement at a time via db.Ado.GetDataTable.
/// Multi-statement and per-tab transaction integration (manual-commit / killTabQuery)
/// land in Phase 13.
/// </summary>
public sealed class RawQueryExecutor
{
    public async Task<RawQueryResultDto> ExecuteAsync(ISqlSugarClient db, string sql, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        DataTable table;
        try
        {
            table = await Task.Run(() => db.Ado.GetDataTable(sql), cancellationToken);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new RawQueryResultDto
            {
                Rows = new List<Dictionary<string, object?>>(),
                Fields = new List<RawQueryFieldDto>(),
                Report = new RawQueryReportDto
                {
                    Duration = (long)sw.Elapsed.TotalMilliseconds,
                    Affected = 0,
                    Error = ex.Message
                }
            };
        }
        sw.Stop();

        var fields = new List<RawQueryFieldDto>(table.Columns.Count);
        foreach (DataColumn col in table.Columns)
        {
            fields.Add(new RawQueryFieldDto
            {
                Name = col.ColumnName,
                Type = col.DataType.Name
            });
        }

        var rows = new List<Dictionary<string, object?>>(table.Rows.Count);
        foreach (DataRow row in table.Rows)
        {
            var dict = new Dictionary<string, object?>(table.Columns.Count);
            foreach (DataColumn col in table.Columns)
            {
                var v = row[col];
                dict[col.ColumnName] = v == DBNull.Value ? null : v;
            }
            rows.Add(dict);
        }

        return new RawQueryResultDto
        {
            Rows = rows,
            Fields = fields,
            Report = new RawQueryReportDto
            {
                Duration = (long)sw.Elapsed.TotalMilliseconds,
                Affected = table.Rows.Count
            }
        };
    }
}

public sealed class RawQueryResultDto
{
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public List<RawQueryFieldDto> Fields { get; set; } = new();
    public RawQueryReportDto Report { get; set; } = new();
}

public sealed class RawQueryFieldDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public sealed class RawQueryReportDto
{
    public long Duration { get; set; }
    public long Affected { get; set; }
    public string? Error { get; set; }
}
