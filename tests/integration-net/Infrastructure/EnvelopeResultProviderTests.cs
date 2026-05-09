using System.Reflection;
using System.Text.Json;
using Antares.Server.Infrastructure;
using Furion.DataValidation;
using Furion.FriendlyException;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

[Trait("Category", "unit")]
public sealed class EnvelopeResultProviderTests
{
    private readonly EnvelopeResultProvider _sut = new();

    [Fact]
    public void OnSucceeded_wraps_payload_in_success_envelope()
    {
        var ctx = NewExecutedCtx();
        var payload = new { hello = "world" };
        var result = _sut.OnSucceeded(ctx, payload);

        var env = ExtractEnvelope(result);
        Assert.Equal("success", env.Status);
        Assert.Same(payload, env.Response);
    }

    [Fact]
    public void OnSucceeded_keeps_response_null_for_null_payload()
    {
        var ctx = NewExecutedCtx();
        var result = _sut.OnSucceeded(ctx, data: null);

        var env = ExtractEnvelope(result);
        Assert.Equal("success", env.Status);
        Assert.Null(env.Response);
    }

    [Fact]
    public void OnException_returns_HTTP_200_with_error_envelope_carrying_message()
    {
        // Memory: returning 500 here would short-circuit httpClient.ts auto-reconnect
        // (see comment in EnvelopeResultProvider.cs). Lock the contract: 200 + status="error".
        var execCtx = NewExecutedCtx();
        var ctx = new ExceptionContext(execCtx, new List<IFilterMetadata>())
        {
            Exception = new InvalidOperationException("No active connection"),
        };
        var metadata = NewExceptionMetadata(errors: "ignored when Exception present");

        var result = _sut.OnException(ctx, metadata);

        var json = (JsonResult)result;
        Assert.Null(json.StatusCode); // explicit null = 200 OK at HTTP layer
        var env = ExtractEnvelope(result);
        Assert.Equal("error", env.Status);
        Assert.Equal("No active connection", env.Response);
    }

    [Fact]
    public void OnException_falls_back_to_metadata_errors_when_exception_is_null()
    {
        var execCtx = NewExecutedCtx();
        var ctx = new ExceptionContext(execCtx, new List<IFilterMetadata>());
        var metadata = NewExceptionMetadata(errors: "boom");

        var result = _sut.OnException(ctx, metadata);

        var env = ExtractEnvelope(result);
        Assert.Equal("error", env.Status);
        Assert.Equal("boom", env.Response);
    }

    [Fact]
    public void OnException_default_message_when_nothing_supplied()
    {
        var execCtx = NewExecutedCtx();
        var ctx = new ExceptionContext(execCtx, new List<IFilterMetadata>());
        var metadata = NewExceptionMetadata(errors: null);

        var result = _sut.OnException(ctx, metadata);

        var env = ExtractEnvelope(result);
        Assert.Equal("internal server error", env.Response);
    }

    [Fact]
    public void OnAuthorizeException_returns_401_with_error_envelope()
    {
        var http = new DefaultHttpContext();
        var metadata = NewExceptionMetadata(errors: "no token");

        var result = _sut.OnAuthorizeException(http, metadata);

        var json = (JsonResult)result;
        Assert.Equal(401, json.StatusCode);
        var env = ExtractEnvelope(result);
        Assert.Equal("error", env.Status);
        Assert.Equal("no token", env.Response);
    }

    [Fact]
    public void OnAuthorizeException_default_message_when_metadata_errors_null()
    {
        var http = new DefaultHttpContext();
        var metadata = NewExceptionMetadata(errors: null);

        var result = _sut.OnAuthorizeException(http, metadata);

        var env = ExtractEnvelope(result);
        Assert.Equal("unauthorized", env.Response);
    }

    [Fact]
    public void OnValidateFailed_returns_400_with_error_envelope()
    {
        var execingCtx = NewExecutingCtx();
        var metadata = NewValidationMetadata(message: "field X required");

        var result = _sut.OnValidateFailed(execingCtx, metadata);

        var json = (JsonResult)result;
        Assert.Equal(400, json.StatusCode);
        var env = ExtractEnvelope(result);
        Assert.Equal("error", env.Status);
        Assert.Equal("field X required", env.Response);
    }

    [Fact]
    public void OnValidateFailed_default_message_when_metadata_message_null()
    {
        var execingCtx = NewExecutingCtx();
        var metadata = NewValidationMetadata(message: null);

        var result = _sut.OnValidateFailed(execingCtx, metadata);

        var env = ExtractEnvelope(result);
        Assert.Equal("validation failed", env.Response);
    }

    [Fact]
    public async Task OnResponseStatusCodes_writes_envelope_with_http_code_text()
    {
        // QUIRK: this method calls JsonSerializer.Serialize directly with no options, so
        // it emits PascalCase ("Status"/"Response") — every OTHER provider method goes
        // through ASP.NET's JsonResult, which uses MVC's camelCase naming policy. The
        // renderer's httpClient.ts checks `data.status === 'error'` (lowercase), so 4xx/5xx
        // responses that flow through this branch don't trigger the auto-reconnect path.
        // This test pins the current PascalCase wire shape; if the production code is fixed
        // to emit camelCase, update both the keys here and the renderer assumption.
        var http = new DefaultHttpContext();
        http.Response.Body = new MemoryStream();

        await _sut.OnResponseStatusCodes(http, statusCode: 404, new UnifyResultSettingsOptions());

        Assert.Equal(404, http.Response.StatusCode);
        Assert.Equal("application/json", http.Response.ContentType);

        http.Response.Body.Position = 0;
        var body = await new StreamReader(http.Response.Body).ReadToEndAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("error", doc.RootElement.GetProperty("Status").GetString());
        Assert.Equal("http 404", doc.RootElement.GetProperty("Response").GetString());
    }

    private static EnvelopeResult<object?> ExtractEnvelope(IActionResult result)
    {
        var json = (JsonResult)result;
        return Assert.IsType<EnvelopeResult<object?>>(json.Value);
    }

    private static ActionExecutedContext NewExecutedCtx()
    {
        var ac = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ActionDescriptor());
        return new ActionExecutedContext(ac, new List<IFilterMetadata>(), controller: new());
    }

    private static ActionExecutingContext NewExecutingCtx()
    {
        var ac = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ActionDescriptor());
        return new ActionExecutingContext(
            ac,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            controller: new());
    }

    // Furion's ExceptionMetadata / ValidationMetadata expose only get-only properties
    // (constructed by Furion's pipeline). Tests need to drive both null + populated
    // branches, so we set the compiler-generated backing fields via reflection.
    private static ExceptionMetadata NewExceptionMetadata(object? errors)
    {
        var m = (ExceptionMetadata)System.Runtime.CompilerServices.RuntimeHelpers
            .GetUninitializedObject(typeof(ExceptionMetadata));
        if (errors is not null) SetBackingField(m, "Errors", errors);
        return m;
    }

    private static ValidationMetadata NewValidationMetadata(string? message)
    {
        var m = new ValidationMetadata();
        if (message is not null) SetBackingField(m, "Message", message);
        return m;
    }

    private static void SetBackingField(object target, string propertyName, object? value)
    {
        var field = target.GetType().GetField(
            $"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field); // fail fast if Furion changes the backing-field convention
        field!.SetValue(target, value);
    }
}
