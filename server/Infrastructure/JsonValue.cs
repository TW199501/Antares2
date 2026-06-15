using System.Text.Json;

namespace Antares.Server.Infrastructure;

/// <summary>
/// Renderer values arrive as JSON and bind to C# <c>object?</c>, which System.Text.Json
/// materializes as <see cref="JsonElement"/>. Passing a raw JsonElement to SqlSugar /
/// ADO.NET as a parameter value writes garbage (the driver can't coerce it). Unwrap it to a
/// CLR primitive first. Non-JsonElement values pass through unchanged, so this is safe to call
/// on any value heading into a SQL parameter dictionary.
/// </summary>
public static class JsonValue
{
    public static object? Unwrap(object? value)
    {
        if (value is not JsonElement je) return value;
        return je.ValueKind switch
        {
            JsonValueKind.String => je.GetString(),
            // (object) cast is load-bearing: without it the ternary unifies long+double to
            // double, so integers would come back as 42.0 instead of 42L.
            JsonValueKind.Number => je.TryGetInt64(out var l) ? (object)l : je.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => je.GetRawText()
        };
    }
}
