using System.Text.Json;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Ai;

/// <summary>
/// /api/ai/translate-column — Google Translate proxy (client=gtx, no API key).
/// Matches Node side at web/main/routes/ai.ts; same response shape `{ description }`.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class AiService : IDynamicApiController
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(15) };

    [HttpPost("/api/ai/translate-column")]
    public async Task<TranslateResultDto> TranslateColumn([FromBody] TranslatePayload p, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(p.ColumnName))
            throw new ArgumentException("columnName is required");

        var target = string.IsNullOrEmpty(p.TargetLocale) ? "zh-TW" : p.TargetLocale.Trim();

        // snake/kebab/camelCase → spaced lowercase phrase
        var phrase = System.Text.RegularExpressions.Regex
            .Replace(System.Text.RegularExpressions.Regex
                .Replace(p.ColumnName, "[_-]+", " "), "([a-z])([A-Z])", "$1 $2")
            .ToLowerInvariant().Trim();

        var url = $"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={Uri.EscapeDataString(target)}&dt=t&q={Uri.EscapeDataString(phrase)}";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.UserAgent.ParseAdd("Mozilla/5.0");
        using var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Google Translate error {(int)resp.StatusCode}: {err[..Math.Min(200, err.Length)]}");
        }

        var json = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        var segments = doc.RootElement[0];
        var description = string.Concat(segments.EnumerateArray().Select(s => s[0].GetString()));

        if (string.IsNullOrWhiteSpace(description))
            throw new InvalidOperationException("Empty translation result");

        return new TranslateResultDto { Description = description.Trim() };
    }

    public sealed class TranslatePayload
    {
        public string ColumnName { get; set; } = string.Empty;
        public string TargetLocale { get; set; } = "zh-TW";
    }

    public sealed class TranslateResultDto
    {
        public string Description { get; set; } = string.Empty;
    }
}
