using Antares.Server.Infrastructure;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

[Trait("Category", "unit")]
public sealed class TokenSourceTests
{
    [Fact]
    public void Token_is_64_uppercase_hex_chars_representing_32_bytes()
    {
        var t = new TokenSource().Token;

        Assert.Equal(64, t.Length);
        Assert.Matches("^[0-9A-F]{64}$", t);
    }

    [Fact]
    public void Token_is_stable_per_instance_across_reads()
    {
        var s = new TokenSource();
        Assert.Equal(s.Token, s.Token);
    }

    [Fact]
    public void Token_differs_between_instances()
    {
        // 256 bits of entropy; collision is astronomically unlikely.
        var a = new TokenSource().Token;
        var b = new TokenSource().Token;
        Assert.NotEqual(a, b);
    }
}
