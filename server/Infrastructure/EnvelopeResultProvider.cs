using System.Net;
using System.Text.Json;
using Furion.DataValidation;
using Furion.FriendlyException;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Antares.Server.Infrastructure;

[UnifyModel(typeof(EnvelopeResult<>))]
public sealed class EnvelopeResultProvider : IUnifyResultProvider
{
    public IActionResult OnAuthorizeException(DefaultHttpContext context, ExceptionMetadata metadata)
    {
        return new JsonResult(new EnvelopeResult<object?>
        {
            Status = "error",
            Response = metadata.Errors?.ToString() ?? "unauthorized"
        })
        {
            StatusCode = (int)HttpStatusCode.Unauthorized
        };
    }

    public IActionResult OnException(ExceptionContext context, ExceptionMetadata metadata)
    {
        var message = context.Exception?.Message
            ?? metadata.Errors?.ToString()
            ?? "internal server error";
        // HTTP 200 + envelope `status: "error"` matches the legacy Node sidecar
        // contract (every captured fixture in tests/fixtures/contract/ is 200).
        // The renderer's httpClient.ts auto-reconnect logic only fires when
        // res.ok && data.status === 'error' && response.includes('No active connection');
        // returning 500 here would short-circuit at the `if (!res.ok) throw` line
        // (httpClient.ts:47) and skip the reconnect handler — surfacing as the
        // user-visible "API error 500: No active connection" toast loop instead
        // of a quiet auto-reconnect.
        return new JsonResult(new EnvelopeResult<object?>
        {
            Status = "error",
            Response = message
        });
    }

    public IActionResult OnSucceeded(ActionExecutedContext context, object? data)
    {
        return new JsonResult(new EnvelopeResult<object?>
        {
            Status = "success",
            Response = data
        });
    }

    public IActionResult OnValidateFailed(ActionExecutingContext context, ValidationMetadata metadata)
    {
        return new JsonResult(new EnvelopeResult<object?>
        {
            Status = "error",
            Response = metadata.Message ?? "validation failed"
        })
        {
            StatusCode = (int)HttpStatusCode.BadRequest
        };
    }

    public async Task OnResponseStatusCodes(HttpContext context, int statusCode, UnifyResultSettingsOptions options)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        var json = JsonSerializer.Serialize(new EnvelopeResult<object?>
        {
            Status = "error",
            Response = $"http {statusCode}"
        });
        await context.Response.WriteAsync(json);
    }
}

public sealed class EnvelopeResult<T>
{
    public string Status { get; init; } = "success";
    public T? Response { get; init; }
}
