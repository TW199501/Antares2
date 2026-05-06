using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;

namespace Antares.Server.IntegrationTests;

[Trait("Category", "unit")]
public sealed class ConnectionConfigBuilderTests
{
    [Theory]
    [InlineData("mysql", DbType.MySql)]
    [InlineData("maria", DbType.MySql)]
    [InlineData("pg", DbType.PostgreSQL)]
    [InlineData("mssql", DbType.SqlServer)]
    [InlineData("sqlite", DbType.Sqlite)]
    public void Build_returns_matching_DbType_for_supported_clients(string client, DbType expected)
    {
        var p = new ConnectionParamsDto
        {
            Uid = "u1",
            Client = client,
            Host = "127.0.0.1",
            Port = 3306,
            User = "u",
            Password = "p",
            Database = "d",
            DatabasePath = ":memory:"
        };

        var config = ConnectionConfigBuilder.Build(p, poolSize: 1);

        Assert.Equal(expected, config.DbType);
    }

    [Fact]
    public void Build_throws_NotSupported_for_firebird_with_actionable_message()
    {
        var p = new ConnectionParamsDto
        {
            Uid = "u-fb",
            Client = "firebird",
            Host = "127.0.0.1",
            Port = 3050,
            User = "SYSDBA",
            Password = "masterkey",
            Database = "test.fdb"
        };

        var ex = Assert.Throws<NotSupportedException>(() => ConnectionConfigBuilder.Build(p, poolSize: 1));

        Assert.Contains("Firebird", ex.Message);
        Assert.Contains(".NET 10 sidecar", ex.Message);
        Assert.Contains("0.8.3 or earlier", ex.Message);
    }

    [Fact]
    public void Build_throws_NotSupported_for_unknown_client()
    {
        var p = new ConnectionParamsDto
        {
            Uid = "u-x",
            Client = "oracle",
            Host = "127.0.0.1",
            Port = 1521,
            User = "system",
            Password = "manager",
            Database = "xe"
        };

        var ex = Assert.Throws<NotSupportedException>(() => ConnectionConfigBuilder.Build(p, poolSize: 1));

        Assert.Contains("unsupported client", ex.Message);
        Assert.Contains("oracle", ex.Message);
    }
}
