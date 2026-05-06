using System.Security.Cryptography;

namespace Antares.Server.Infrastructure;

public interface ITokenSource
{
    string Token { get; }
}

public sealed class TokenSource : ITokenSource
{
    public string Token { get; } = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
}
