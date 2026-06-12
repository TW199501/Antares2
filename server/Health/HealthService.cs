using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Health;

[ApiDescriptionSettings(KeepName = true)]
public sealed class HealthService : IDynamicApiController
{
    [HttpGet("/health"), NonUnify]
    public string Get() => "ok";
}
