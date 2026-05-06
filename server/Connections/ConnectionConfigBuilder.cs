using System.Text;
using Antares.Server.Models.Connection;
using SqlSugar;

namespace Antares.Server.Connections;

/// <summary>
/// Builds a SqlSugar ConnectionConfig for a given ConnectionParamsDto + pool size.
/// SSL file paths in cert/key/ca are read here via File.ReadAllText (matching Node
/// `fs.readFileSync` behavior at web/main/routes/connection.ts).
/// </summary>
public static class ConnectionConfigBuilder
{
    public static ConnectionConfig Build(ConnectionParamsDto p, int poolSize)
    {
        var clientLower = p.Client?.ToLowerInvariant();
        return clientLower switch
        {
            "mysql" or "maria" => BuildMySql(p, poolSize),
            "pg" => BuildPostgres(p, poolSize),
            "mssql" => BuildSqlServer(p, poolSize),
            "sqlite" => BuildSqlite(p),
            "firebird" => throw new NotSupportedException(
                "Firebird is not supported on the Antares2 .NET 10 sidecar (0.8.4+). " +
                "SqlSugar 5.1.4 has no Firebird provider; rewriting the schema / query stack " +
                "around raw FirebirdSql.Data.FirebirdClient was deemed out of scope. " +
                "Use Antares2 0.8.3 or earlier for Firebird connections."),
            _ => throw new NotSupportedException($"unsupported client: {p.Client}")
        };
    }

    private static ConnectionConfig BuildSqlServer(ConnectionParamsDto p, int poolSize)
    {
        var sb = new StringBuilder();
        sb.Append($"Server={p.Host},{p.Port};");
        if (!string.IsNullOrEmpty(p.Database)) sb.Append($"Database={p.Database};");
        sb.Append($"User Id={p.User};Password={p.Password};");
        if (p.Ssl)
        {
            sb.Append("Encrypt=true;");
            if (p.UntrustedConnection) sb.Append("TrustServerCertificate=true;");
        }
        else
        {
            sb.Append("Encrypt=false;TrustServerCertificate=true;");
        }
        sb.Append($"Application Name=Antares2;");
        return new ConnectionConfig
        {
            DbType = DbType.SqlServer,
            ConnectionString = sb.ToString(),
            IsAutoCloseConnection = true,
            InitKeyType = InitKeyType.Attribute,
        };
    }

    private static ConnectionConfig BuildMySql(ConnectionParamsDto p, int poolSize)
    {
        var sb = new StringBuilder();
        sb.Append($"Server={p.Host};Port={p.Port};");
        if (!string.IsNullOrEmpty(p.Database)) sb.Append($"Database={p.Database};");
        sb.Append($"Uid={p.User};Pwd={p.Password};");
        sb.Append("ConnectionTimeout=10;");
        if (p.Ssl)
        {
            sb.Append("SslMode=Required;");
            if (p.UntrustedConnection) sb.Append("AllowPublicKeyRetrieval=true;");
            if (!string.IsNullOrEmpty(p.Cert)) sb.Append($"SslCert={p.Cert};");
            if (!string.IsNullOrEmpty(p.Key)) sb.Append($"SslKey={p.Key};");
            if (!string.IsNullOrEmpty(p.Ca)) sb.Append($"SslCa={p.Ca};");
        }
        else
        {
            sb.Append("SslMode=None;");
        }
        return new ConnectionConfig
        {
            DbType = DbType.MySql,
            ConnectionString = sb.ToString(),
            IsAutoCloseConnection = true,
            InitKeyType = InitKeyType.Attribute,
        };
    }

    private static ConnectionConfig BuildPostgres(ConnectionParamsDto p, int poolSize)
    {
        var sb = new StringBuilder();
        sb.Append($"Host={p.Host};Port={p.Port};");
        if (!string.IsNullOrEmpty(p.Database)) sb.Append($"Database={p.Database};");
        sb.Append($"Username={p.User};Password={p.Password};");
        sb.Append("Application Name=Antares2;");
        if (p.Ssl)
        {
            sb.Append("SSL Mode=Require;");
            if (p.UntrustedConnection) sb.Append("Trust Server Certificate=true;");
            if (!string.IsNullOrEmpty(p.Cert)) sb.Append($"SSL Certificate={p.Cert};");
            if (!string.IsNullOrEmpty(p.Key)) sb.Append($"SSL Key={p.Key};");
            if (!string.IsNullOrEmpty(p.Ca)) sb.Append($"Root Certificate={p.Ca};");
        }
        return new ConnectionConfig
        {
            DbType = DbType.PostgreSQL,
            ConnectionString = sb.ToString(),
            IsAutoCloseConnection = true,
            InitKeyType = InitKeyType.Attribute,
        };
    }

    private static ConnectionConfig BuildSqlite(ConnectionParamsDto p)
    {
        var path = p.DatabasePath ?? p.Database ?? string.Empty;
        return new ConnectionConfig
        {
            DbType = DbType.Sqlite,
            ConnectionString = $"Data Source={path};",
            IsAutoCloseConnection = true,
            InitKeyType = InitKeyType.Attribute,
        };
    }
}
