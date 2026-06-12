using Antares.Server.Workers;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// /api/schema/{export, abortExport, importSql, abortImportSql}.
/// HTTP endpoints START a task and return its taskId; the actual progress stream
/// flows over /ws/export and /ws/import (Phase 14 + 15 hubs).
///
/// Phase 13 baseline: register a TaskHandle, start the worker, return taskId.
/// Phase 14/15 wires the workers to real per-DB dump/restore logic.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class ExportImportService : IDynamicApiController
{
    private readonly TaskRegistry _tasks;

    public ExportImportService(TaskRegistry tasks) => _tasks = tasks;

    [HttpPost("/api/schema/export"), NonUnify]
    public object Export([FromBody] ExportPayload p)
    {
        var handle = _tasks.Start(TaskRegistry.TaskKind.Export);
        // The worker (Phase 14) will be kicked off when the renderer opens the WS.
        return new { status = "success", response = new { taskId = handle.TaskId } };
    }

    [HttpPost("/api/schema/abortExport"), NonUnify]
    public object AbortExport([FromBody] TaskIdPayload p)
    {
        _tasks.Cancel(p.TaskId ?? string.Empty);
        return new { status = "success" };
    }

    [HttpPost("/api/schema/importSql"), NonUnify]
    public object ImportSql([FromBody] ImportPayload p)
    {
        var handle = _tasks.Start(TaskRegistry.TaskKind.Import);
        return new { status = "success", response = new { taskId = handle.TaskId } };
    }

    [HttpPost("/api/schema/abortImportSql"), NonUnify]
    public object AbortImportSql([FromBody] TaskIdPayload p)
    {
        _tasks.Cancel(p.TaskId ?? string.Empty);
        return new { status = "success" };
    }

    public sealed class ExportPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Type { get; set; }
        public List<string>? Tables { get; set; }
    }

    public sealed class ImportPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? FilePath { get; set; }
    }

    public sealed class TaskIdPayload
    {
        public string? TaskId { get; set; }
    }
}
