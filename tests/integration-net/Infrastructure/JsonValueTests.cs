using System.Text.Json;
using Antares.Server.Infrastructure;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

[Trait("Category", "unit")]
public sealed class JsonValueTests
{
    // Mirrors how the renderer's JSON values reach a service: deserialized to object? => JsonElement.
    private static object? FromJson(string json) =>
        JsonValue.Unwrap(JsonSerializer.Deserialize<object?>(json));

    [Fact]
    public void String_unwraps_to_string() => Assert.Equal("hi", FromJson("\"hi\""));

    [Fact]
    public void Integer_unwraps_to_long() => Assert.Equal(42L, FromJson("42"));

    [Fact]
    public void Decimal_unwraps_to_double() => Assert.Equal(1.5d, FromJson("1.5"));

    [Fact]
    public void True_unwraps_to_bool() => Assert.Equal(true, FromJson("true"));

    [Fact]
    public void False_unwraps_to_bool() => Assert.Equal(false, FromJson("false"));

    [Fact]
    public void Null_unwraps_to_null() => Assert.Null(FromJson("null"));

    [Fact]
    public void Non_json_element_passes_through() => Assert.Equal(7, JsonValue.Unwrap(7));

    [Fact]
    public void Null_reference_passes_through() => Assert.Null(JsonValue.Unwrap(null));
}
