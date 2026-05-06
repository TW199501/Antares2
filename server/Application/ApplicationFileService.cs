using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Application;

/// <summary>
/// /api/app/{readFile, writeFile}.
///
/// Plan §693 lock: paths must be inside %APPDATA%/com.tw199501.antares2/ on Windows
/// (or platform-equivalent) — anything outside is a path-traversal attempt and gets
/// rejected with 401. Compare via Path.GetFullPath().StartsWith(GetFullPath(appData)).
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class ApplicationFileService : IDynamicApiController
{
    private readonly string _appDataDir;
    private readonly ILogger<ApplicationFileService> _logger;

    public ApplicationFileService(ILogger<ApplicationFileService> logger)
    {
        _logger = logger;
        _appDataDir = Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "com.tw199501.antares2"));
        Directory.CreateDirectory(_appDataDir);
    }

    [HttpPost("/api/app/readFile")]
    public string ReadFile([FromBody] ReadFilePayload p)
    {
        var safe = ResolveAndGuard(p.FilePath);
        return File.ReadAllText(safe, System.Text.Encoding.UTF8);
    }

    [HttpPost("/api/app/writeFile")]
    public object WriteFile([FromBody] WriteFilePayload p)
    {
        var safe = ResolveAndGuard(p.FilePath);
        Directory.CreateDirectory(Path.GetDirectoryName(safe) ?? _appDataDir);
        File.WriteAllText(safe, p.Content ?? string.Empty, System.Text.Encoding.UTF8);
        return new { status = "success" };
    }

    private string ResolveAndGuard(string path)
    {
        if (string.IsNullOrEmpty(path))
            throw new ArgumentException("filePath is required");
        var full = Path.GetFullPath(path);
        if (!full.StartsWith(_appDataDir, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Path traversal blocked: {Path} not under {Root}", full, _appDataDir);
            throw new UnauthorizedAccessException($"path '{path}' is outside the app-data sandbox");
        }
        return full;
    }

    public sealed class ReadFilePayload
    {
        public string FilePath { get; set; } = string.Empty;
        public string? Encoding { get; set; }
    }

    public sealed class WriteFilePayload
    {
        public string FilePath { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }
}
