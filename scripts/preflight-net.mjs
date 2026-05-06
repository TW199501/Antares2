#!/usr/bin/env node
// Phase 0 hard gate: verify .NET 10 SDK + NuGet restore for the sidecar's package set.
// Plan: docs/superpowers/plans/2026-05-05-net-sidecar-migration.md (Phase 0 §93-124).
// Probe csproj declares the same packages plan §194 locks for server/AntaresServer.csproj.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REQUIRED_MAJOR = 10;

const PROBE_CSPROJ = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RestorePackagesWithLockFile>false</RestorePackagesWithLockFile>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Furion" Version="4.9.8.*" />
    <PackageReference Include="SqlSugarCore" Version="5.1.4.*" />
    <PackageReference Include="SSH.NET" Version="2024.*" />
    <PackageReference Include="MySqlConnector" Version="2.*" />
    <PackageReference Include="Npgsql" Version="8.*" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="5.*" />
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.*" />
    <PackageReference Include="Bogus" Version="35.*" />
  </ItemGroup>
</Project>
`;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

let version;
try {
  version = execFileSync('dotnet', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (err) {
  fail(`dotnet CLI not found in PATH. Install .NET ${REQUIRED_MAJOR} SDK from https://dotnet.microsoft.com/download`);
}

const majorMatch = version.match(/^(\d+)\./);
if (!majorMatch) fail(`unexpected dotnet --version output: ${version}`);
const major = Number(majorMatch[1]);
if (major < REQUIRED_MAJOR) {
  fail(`dotnet ${version} < required ${REQUIRED_MAJOR}.x. Install .NET ${REQUIRED_MAJOR} SDK.`);
}
ok(`dotnet --version → ${version} (>= ${REQUIRED_MAJOR}.0)`);

const dir = mkdtempSync(join(tmpdir(), 'antares2-preflight-net-'));
const csprojPath = join(dir, 'Probe.csproj');
writeFileSync(csprojPath, PROBE_CSPROJ);

const cleanup = () => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

console.log(`▸ NuGet restore probe in ${dir} ...`);
const result = spawnSync('dotnet', ['restore', csprojPath, '--verbosity', 'minimal'], {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.status !== 0) {
  fail(`dotnet restore failed (exit ${result.status}). See output above.`);
}
ok('NuGet restore succeeded for Furion + SqlSugar + SSH.NET + 4 DB drivers + Bogus');

console.log('\n✓ preflight:net passed');
process.exit(0);
