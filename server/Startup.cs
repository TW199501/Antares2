using Antares.Server.Connections;
using Antares.Server.Infrastructure;
using Antares.Server.Schemas;
using Antares.Server.Workers;
using Antares.Server.WebSockets;
using Furion;

namespace Antares.Server;

public sealed class AntaresStartup : AppStartup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<ITokenSource, TokenSource>();

        // Connection layer (Phase 6)
        services.AddSingleton<ConnectionRegistry>();
        services.AddSingleton<SshTunnelService>();
        services.AddSingleton<SchemaTreeBuilder>();
        services.AddSingleton<RawQueryExecutor>();
        services.AddSingleton<TaskRegistry>();
        services.AddSingleton<ExportImportHub>();
        services.AddSingleton<IQueryCanceller, MysqlQueryCanceller>();
        services.AddSingleton<IQueryCanceller, PgQueryCanceller>();
        services.AddSingleton<IQueryCanceller, MssqlQueryCanceller>();
        services.AddSingleton<IQueryCanceller, SqliteQueryCanceller>();

        services.AddCorsAccessor();
        services.AddControllers()
            .AddInjectWithUnifyResult<EnvelopeResultProvider>();
        services.AddHostedService<ReadyLineHook>();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment()) app.UseDeveloperExceptionPage();

        app.UseCorsAccessor();
        app.UseWebSockets();
        app.UseRouting();
        // Furion Swagger UI — default routePrefix "api" mounts UI at /api/index.html,
        // OpenAPI doc at /api/{group}/swagger.json. Mounted BEFORE SidecarTokenMiddleware
        // so internal API browsing during dev/debug doesn't need a token header. Sidecar
        // binds 127.0.0.1 only so this is loopback-private regardless.
        app.UseInject();
        app.UseMiddleware<SidecarTokenMiddleware>();
        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.Map("/ws/export", async ctx =>
            {
                var hub = ctx.RequestServices.GetRequiredService<ExportImportHub>();
                await hub.HandleAsync(ctx, TaskRegistry.TaskKind.Export);
            });
            endpoints.Map("/ws/import", async ctx =>
            {
                var hub = ctx.RequestServices.GetRequiredService<ExportImportHub>();
                await hub.HandleAsync(ctx, TaskRegistry.TaskKind.Import);
            });
        });
    }
}
