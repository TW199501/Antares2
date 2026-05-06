using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Echo;

[ApiDescriptionSettings(KeepName = true)]
public sealed class EchoService : IDynamicApiController
{
    [HttpPost("/api/echo")]
    public Dictionary<string, object?> Post([FromBody] Dictionary<string, object?> payload)
        => payload ?? new Dictionary<string, object?>();
}
