using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;

namespace Antares.Server.IntegrationTests.Connections;

/// <summary>
/// Locks the connection-string text produced for each driver. These strings are the
/// boundary contract with the underlying ADO.NET providers (MySqlConnector / Npgsql /
/// Microsoft.Data.SqlClient / Microsoft.Data.Sqlite). A typo here surfaces only at
/// connect time, so the cheap unit guard here is worth its weight.
/// </summary>
[Trait("Category", "unit")]
public sealed class ConnectionConfigBuilderConnStringTests
{
    private static ConnectionParamsDto NewParams(string client) => new()
    {
        Uid = "u",
        Client = client,
        Host = "db.example.com",
        Port = 3306,
        User = "alice",
        Password = "s3cret",
        Database = "shop",
    };

    // ---------- MySQL / MariaDB ----------

    [Theory]
    [InlineData("mysql")]
    [InlineData("maria")]
    [InlineData("MYSQL")]
    [InlineData("Maria")]
    public void Mysql_client_is_case_insensitive(string client)
    {
        var p = NewParams(client);
        var cfg = ConnectionConfigBuilder.Build(p, poolSize: 1);
        Assert.Equal(DbType.MySql, cfg.DbType);
    }

    [Fact]
    public void Mysql_no_ssl_emits_SslMode_None_and_no_AllowPublic_flag()
    {
        var p = NewParams("mysql");
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("Server=db.example.com;Port=3306;", cs);
        Assert.Contains("Database=shop;", cs);
        Assert.Contains("Uid=alice;Pwd=s3cret;", cs);
        Assert.Contains("ConnectionTimeout=10;", cs);
        Assert.Contains("SslMode=None;", cs);
        Assert.DoesNotContain("AllowPublic", cs);
    }

    [Fact]
    public void Mysql_ssl_with_untrusted_adds_AllowPublic_key_flag()
    {
        var p = NewParams("mysql");
        p.Ssl = true;
        p.UntrustedConnection = true;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("SslMode=Required;", cs);
        Assert.Contains("AllowPublic", cs);
        Assert.DoesNotContain("SslMode=None", cs);
    }

    [Fact]
    public void Mysql_ssl_with_cert_key_ca_emits_all_three()
    {
        var p = NewParams("mysql");
        p.Ssl = true;
        p.Cert = "/etc/mysql/client-cert.pem";
        p.Key = "/etc/mysql/client-key.pem";
        p.Ca = "/etc/mysql/ca.pem";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("SslCert=/etc/mysql/client-cert.pem;", cs);
        Assert.Contains("SslKey=/etc/mysql/client-key.pem;", cs);
        Assert.Contains("SslCa=/etc/mysql/ca.pem;", cs);
    }

    [Fact]
    public void Mysql_without_database_omits_Database_segment()
    {
        var p = NewParams("mysql");
        p.Database = null;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.DoesNotContain("Database=", cs);
    }

    [Fact]
    public void Mysql_with_empty_database_omits_Database_segment()
    {
        var p = NewParams("mysql");
        p.Database = "";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.DoesNotContain("Database=", cs);
    }

    // ---------- PostgreSQL ----------

    [Fact]
    public void Pg_default_includes_application_name_and_host_port_user()
    {
        var p = NewParams("pg");
        p.Port = 5432;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("Host=db.example.com;Port=5432;", cs);
        Assert.Contains("Database=shop;", cs);
        Assert.Contains("Username=alice;Password=s3cret;", cs);
        Assert.Contains("Application Name=Antares2;", cs);
        Assert.DoesNotContain("SSL Mode", cs);
    }

    [Fact]
    public void Pg_ssl_with_untrusted_adds_TrustServerCertificate()
    {
        var p = NewParams("pg");
        p.Port = 5432;
        p.Ssl = true;
        p.UntrustedConnection = true;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("SSL Mode=Require;", cs);
        Assert.Contains("Trust Server Certificate=true;", cs);
    }

    [Fact]
    public void Pg_ssl_with_certs_uses_npgsql_keys()
    {
        var p = NewParams("pg");
        p.Port = 5432;
        p.Ssl = true;
        p.Cert = "/p/cli.pem";
        p.Key = "/p/cli.key";
        p.Ca = "/p/root.pem";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("SSL Certificate=/p/cli.pem;", cs);
        Assert.Contains("SSL Key=/p/cli.key;", cs);
        Assert.Contains("Root Certificate=/p/root.pem;", cs);
    }

    // ---------- SQL Server ----------

    [Fact]
    public void Mssql_default_disables_encryption_but_trusts_server_cert()
    {
        // Local-dev MSSQL containers often don't have a valid TLS cert; the no-SSL
        // branch still sets TrustServerCertificate=true so connections succeed.
        var p = NewParams("mssql");
        p.Port = 1433;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("Server=db.example.com,1433;", cs);
        Assert.Contains("Database=shop;", cs);
        Assert.Contains("User Id=alice;Password=s3cret;", cs);
        Assert.Contains("Encrypt=false;", cs);
        Assert.Contains("TrustServerCertificate=true;", cs);
        Assert.Contains("Application Name=Antares2;", cs);
    }

    [Fact]
    public void Mssql_ssl_with_trusted_does_not_set_TrustServerCertificate()
    {
        var p = NewParams("mssql");
        p.Port = 1433;
        p.Ssl = true;
        p.UntrustedConnection = false;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("Encrypt=true;", cs);
        Assert.DoesNotContain("TrustServerCertificate=true;", cs);
    }

    [Fact]
    public void Mssql_ssl_with_untrusted_sets_TrustServerCertificate()
    {
        var p = NewParams("mssql");
        p.Port = 1433;
        p.Ssl = true;
        p.UntrustedConnection = true;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Contains("Encrypt=true;", cs);
        Assert.Contains("TrustServerCertificate=true;", cs);
    }

    [Fact]
    public void Mssql_without_database_omits_Database_segment()
    {
        var p = NewParams("mssql");
        p.Port = 1433;
        p.Database = null;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.DoesNotContain("Database=", cs);
    }

    // ---------- SQLite ----------

    [Fact]
    public void Sqlite_uses_DatabasePath_when_present()
    {
        var p = NewParams("sqlite");
        p.DatabasePath = "/var/data/app.sqlite";
        p.Database = "ignored";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Equal("Data Source=/var/data/app.sqlite;", cs);
    }

    [Fact]
    public void Sqlite_falls_back_to_Database_when_DatabasePath_null()
    {
        var p = NewParams("sqlite");
        p.DatabasePath = null;
        p.Database = "/var/data/legacy.sqlite";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Equal("Data Source=/var/data/legacy.sqlite;", cs);
    }

    [Fact]
    public void Sqlite_with_no_path_emits_empty_data_source()
    {
        var p = NewParams("sqlite");
        p.DatabasePath = null;
        p.Database = null;
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Equal("Data Source=;", cs);
    }

    [Fact]
    public void Sqlite_supports_in_memory_data_source()
    {
        var p = NewParams("sqlite");
        p.DatabasePath = ":memory:";
        var cs = ConnectionConfigBuilder.Build(p, poolSize: 1).ConnectionString;
        Assert.Equal("Data Source=:memory:;", cs);
    }

    // ---------- Cross-cutting config defaults ----------

    [Theory]
    [InlineData("mysql")]
    [InlineData("pg")]
    [InlineData("mssql")]
    [InlineData("sqlite")]
    public void All_supported_clients_use_attribute_init_and_auto_close(string client)
    {
        var p = NewParams(client);
        if (client == "pg") p.Port = 5432;
        if (client == "mssql") p.Port = 1433;
        if (client == "sqlite") p.DatabasePath = ":memory:";

        var cfg = ConnectionConfigBuilder.Build(p, poolSize: 1);

        Assert.True(cfg.IsAutoCloseConnection);
        Assert.Equal(InitKeyType.Attribute, cfg.InitKeyType);
    }
}
