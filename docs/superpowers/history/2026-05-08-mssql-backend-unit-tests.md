# MSSQL 後端單元測試導入計畫

> Status: draft / not started
> Owner: tw199501
> Date: 2026-05-08
> Scope: `server/Tables/TablesReadService.cs`（MSSQL 分支） + 純函式 helpers
> Estimate: 6–9h，分 5 phase

## Context

目前 `tests/integration-net/` 共 8 spec，**全部集中在 `Infrastructure/`** 跨切面（envelope / token / port / ready line）+ `Connections/ConnectionConfigBuilder` 的純組裝邏輯。Business services（`Connections/ConnectionService`、`Schemas/*`、`Tables/*`、`Views/*`、…）**整片裸奔，0 test**。

CLAUDE.md `### .NET sidecar gotchas` 第二條把「SqlSugar `DbMaintenance` 對 MSSQL reserved-word table name 會炸」標記為 **canonical gotcha**，對應的修法（手刻 `sys.columns + sys.types + sys.default_constraints + sys.indexes + sys.extended_properties` query）目前位於 `TablesReadService.GetColumns`（Lines 40-77），**沒有任何測試守護**。一旦未來有人「順手把 `if (entry.Client == "mssql")` 那段 refactor 掉」，重現的就是 0.8.x 系列裡發生過的 `Incorrect syntax near 'User'` regression。

本計畫的目標是 **鎖住 MSSQL 路徑的現行行為**，依 ROI 從最痛的 `GetColumns` 開始，一路掃到整個 `TablesReadService`。**不修任何 production code**（characterization test，按 `frontend-unit-test-rollout` v2 plan 的 "subagents that find a source bug do not fix it" 原則）。

## 為什麼 ROI 排第一是 `TablesReadService`

| 候選 | 痛點 | 為什麼不是這次第一輪 |
|------|------|---------------------|
| `ConnectionService` (`[NonUnify]` 五個 endpoint) | envelope 雙包覆 silent swallow | 已被 `EnvelopeResultProviderTests` + 整合層 `SkeletonHealthTests` 部份覆蓋；wire contract 由前端 `tests/fixtures/contract/*.json` + `pnpm replay:contract` 端到端守 |
| `TablesReadService.GetColumns` MSSQL 分支 | 已知 reserved-word regression、手刻 catalog query 沒人守 | **第一輪做這個** |
| `Schemas/SchemaTreeBuilder` | renderer 入口資料、shape 漂移影響面大 | 牽涉 4 種 client × N 種 schema 物件，scope 太大，下一輪 |
| `Views/Triggers/Routines/Functions/Schedulers/Users` | 部份在 0.8.x 還沒被 renderer 大量呼叫 | 流量低，先擺後面 |

---

## 架構決定

### 為什麼用 Testcontainers.MsSql 而不是 mock / LocalDB / SQLite-stub

**結論：用 `Testcontainers.MsSql` 跑真實 SQL Server 2022 容器，靠環境變數 / Docker 偵測 gate skip。**

| 選項 | 為什麼不選 |
|------|-----------|
| 純 Mock SqlSugar | 手刻 `sys.*` query 的整個 **存在意義** 就是 SqlSugar `DbMaintenance` 對 MSSQL 行為錯。Mock 出來的 `db.Ado.SqlQuery<T>` 等於 **重建 bug 的條件**——測試永遠 PASS、prod 永遠炸。歷史 regression 證明這條路死路。 |
| LocalDB (mssqllocaldb) | Windows-only，CI 三平台（Win / mac / linux）至少 2 個跑不動。Docker 能在三台都動，CI matrix 不分裂。 |
| SQLite 假扮 MSSQL | `sys.columns / sys.tables / sys.extended_properties / IDENT_CURRENT / OBJECT_DEFINITION / OFFSET ... FETCH NEXT` 全部沒有；`STRING_AGG` 語法也不同。等於沒測。 |
| 共用一個現成 staging server | dev box 之間網路 + 認證 + 共享 schema dirty 狀態，測試會互相打架；CI 還要噴 secret。 |

**Skip 條件**：執行測試時若 Docker daemon 不可用（`docker info` 失敗），整個 trait `[Trait("Category", "mssql-container")]` skip 並印警告，不擋 CI。**第一輪暫不接到 `test-build.yml` 的 hard gate**——本機開發 + 手動 dispatch 即可，等行為穩了再決定要不要進 merge gate。

### 為什麼分成「純 helpers 測試」+「container 測試」兩組

`TablesReadService` 內三個 static helper（`Sanitize` / `QualifyTable` / `QuoteIdent`）是純字串運算，不需要 Docker。拆出去能：

1. CI 在沒 Docker 的環境（codeql / docs-only PR）依然能跑這組 fast unit test。
2. 任何字元跳脫 regression（例如有人把 `Sanitize` 從 `Replace("--", "")` 拿掉）會 < 1 秒被擋下，不用等 container 起來。
3. 對應的 trait：`[Trait("Category", "unit")]`（純）vs `[Trait("Category", "mssql-container")]`（重）。

---

## Phase 拆解

### Phase 1 — `TablesReadService` 純 helpers 測試（~30 min）

**檔案**：`tests/integration-net/Tables/TablesReadServiceHelpersTests.cs`

**前置**：把 `Sanitize` / `QualifyTable` / `QuoteIdent` 的可見度從 `private static` 拉到 `internal static`，並在 `server/AntaresServer.csproj` 加 `<InternalsVisibleTo Include="Server.IntegrationTests" />`。**不**改演算法。

**測試矩陣**（pure，不用 Docker）：

| Helper | Case | 期望 |
|--------|------|------|
| `Sanitize` | 含 `[` `]` `` ` `` `"` `;` `--` 全部拿掉 | 6 種注入字元都被剝除 |
| `Sanitize` | 純 ASCII identifier | 不變 |
| `Sanitize` | UTF-8 中文表名 | 中文保留（目前的行為，pin 住） |
| `QualifyTable("mssql", "dbo", "User")` | | `[dbo].[User]` |
| `QualifyTable("mssql", null, "User")` | | `[User]` |
| `QualifyTable("mssql", "", "User")` | | `[User]`（空字串視同無 schema） |
| `QualifyTable("mysql", "db", "t")` | | `` `db`.`t` `` |
| `QualifyTable("maria", "db", "t")` | | `` `db`.`t` `` |
| `QualifyTable("pg", "public", "t")` | | `"public"."t"` |
| `QualifyTable("sqlite", "", "t")` | | `"t"` |
| `QualifyTable("mssql", "dbo", "U]ser; DROP TABLE")` | injection attempt | `[dbo].[User DROP TABLE]`（Sanitize 拿掉惡意字元 + 仍包 bracket） |
| `QuoteIdent` × 4 client | | bracket / backtick / double-quote 對齊 `QualifyTable` |

**驗收**：`dotnet test --filter "Category=unit&FullyQualifiedName~TablesReadServiceHelpers"` 全綠 < 1s。

---

### Phase 2 — Testcontainers 基建（~2-3h）

**目標**：產出 `MssqlContainerFixture`，整個 test class collection 共用一個 SQL Server 2022 container；container 內 seed 三張代表性 table（reserved-word + 一般 + dropped column）；曝露給測試一份就緒的 `ConnectionRegistry`，讓 `TablesReadService` 直接吃 `entry.Db.Ado.SqlQuery<T>`。

#### 步驟

1. **加 NuGet**：在 `tests/integration-net/Server.IntegrationTests.csproj` 新增
   ```xml
   <PackageReference Include="Testcontainers.MsSql" Version="3.10.0" />
   ```
   （3.10 line 對應 .NET 10 已測過 OK；若 SDK preflight 失敗 fallback 3.9）

2. **Fixture**：`tests/integration-net/Tables/MssqlContainerFixture.cs`
   - 實作 `IAsyncLifetime`
   - `InitializeAsync`：
     - 偵測 Docker：嘗試 `new DockerClientConfiguration().CreateClient().System.PingAsync()`；失敗時把 `Skip` 旗標設 true，每個測試 method 用 `Skip.IfNot(fixture.DockerAvailable, "Docker not available")`（xUnit `Skip` 套件，已在 `Microsoft.NET.Test.Sdk` 17.11 內建）
     - 啟動 `MsSqlBuilder().WithImage("mcr.microsoft.com/mssql/server:2022-latest").WithPassword("Antares!Test1").Build()`，await `StartAsync()`
     - 用 `Microsoft.Data.SqlClient` 建一個 master connection，跑 schema seed SQL（見下）
     - 透過 `ConnectionConfigBuilder.Build` 組 SqlSugar config（pool=1，client=`mssql`），塞進新建的 `ConnectionRegistry`，uid 寫死 `"test-mssql"`
   - `DisposeAsync`：`StopAsync()` + `DisposeAsync()`

3. **Seed SQL**（embedded resource `tests/integration-net/Tables/seed.sql`）：
   ```sql
   CREATE DATABASE Antares2Test;
   GO
   USE Antares2Test;
   GO

   -- 1) reserved-word 表（CLAUDE.md gotcha #2 的核心 case）
   CREATE TABLE [dbo].[User] (
      [Id] INT IDENTITY(1,1) NOT NULL,
      [Name] NVARCHAR(100) NOT NULL,
      [Email] NVARCHAR(200) NULL DEFAULT N'noreply@example.com',
      CONSTRAINT [PK_User] PRIMARY KEY ([Id])
   );
   EXEC sp_addextendedproperty
      @name = N'MS_Description', @value = N'使用者主檔',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE',  @level1name = N'User';
   EXEC sp_addextendedproperty
      @name = N'MS_Description', @value = N'登入帳號',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE',  @level1name = N'User',
      @level2type = N'COLUMN', @level2name = N'Name';

   -- 2) 一般表（沒 reserved word，沒 IDENTITY，有 CHECK / FK / 多欄 PK）
   CREATE TABLE [dbo].[Region] (
      [Code] CHAR(2) NOT NULL,
      [Country] CHAR(2) NOT NULL,
      [Display] NVARCHAR(50) NOT NULL,
      CONSTRAINT [PK_Region] PRIMARY KEY ([Code], [Country]),
      CONSTRAINT [CK_Region_CodeUpper] CHECK (UPPER([Code]) = [Code])
   );

   -- 3) dropped-column 表（驗證 ROW_NUMBER() OVER (ORDER BY column_id) 補洞）
   CREATE TABLE [dbo].[WithGap] (
      [A] INT, [B] INT, [C] INT, [D] INT
   );
   ALTER TABLE [dbo].[WithGap] DROP COLUMN [B];

   -- 4) FK + index 樣本（給 GetIndexes / GetKeyUsage / GetForeignList 用）
   CREATE TABLE [dbo].[UserAddress] (
      [Id] INT IDENTITY(1,1) PRIMARY KEY,
      [UserId] INT NOT NULL,
      [City] NVARCHAR(50) NOT NULL,
      CONSTRAINT [FK_UserAddress_User] FOREIGN KEY ([UserId])
         REFERENCES [dbo].[User]([Id])
   );
   CREATE INDEX [IX_UserAddress_City] ON [dbo].[UserAddress] ([City]);
   CREATE UNIQUE INDEX [UX_UserAddress_UserId_City]
      ON [dbo].[UserAddress] ([UserId], [City]);

   -- 5) 空 schema（確認 schema filter 正確）
   CREATE SCHEMA [other];
   GO
   CREATE TABLE [other].[User] ([X] INT NOT NULL);  -- 同名異 schema
   ```

4. **Collection definition**：`MssqlCollection.cs` 標 `[CollectionDefinition("mssql")]`，所有 MSSQL 測試 class 標 `[Collection("mssql")]` 共用同一個 container，container 起一次跑全部，估計 startup ~12s + 每個 test ~50ms。

5. **環境變數 escape hatch**：`ANTARES_SKIP_MSSQL_CONTAINER=1` 強制 skip（給 CI 第一階段 / 本機沒裝 Docker 時用）。

**驗收**：寫一個 `MssqlContainerFixtureSmokeTest`，標 `[Collection("mssql")]`，內容 `Assert.Equal(1, await entry.Db.Ado.GetIntAsync("SELECT 1"))`。Docker 可用時 GREEN，不可用時 SKIP（不是 FAIL）。

---

### Phase 3 — `GetColumns` characterization tests（~1-2h）

**檔案**：`tests/integration-net/Tables/TablesReadService_GetColumns_Mssql_Tests.cs`
**Trait**：`[Trait("Category", "mssql-container")]`、`[Collection("mssql")]`

**測試矩陣**（每一條都對應現行行為，不允諾新功能）：

| # | Case | 鎖什麼 |
|---|------|--------|
| C1 | `Schema="dbo", Table="User"` | 不丟 `Incorrect syntax near 'User'`、回傳非空（**這條最重要 — CLAUDE.md gotcha #2 的 canonical 守護**） |
| C2 | `[dbo].[User]` 的 `[Id]` 欄 | `IsPrimary=true`、`AutoIncrement=true`、`Nullable=false` |
| C3 | `[dbo].[User]` 的 `[Email]` 欄 | `Default=N'noreply@example.com'`（含 N 前綴，pin 住目前的 `dc.definition` 形式） |
| C4 | `[dbo].[User]` 的 `[Name]` 欄 | `Comment="登入帳號"`（驗 extended_properties left join + class=1） |
| C5 | `[dbo].[User]` 沒 comment 的欄 | `Comment=""`（不 fallback，符合 memory `feedback_column_comment_no_fallback`） |
| C6 | `[dbo].[WithGap]` 三欄 | 回傳 3 筆且 `Order=1,2,3`（連續，ROW_NUMBER 補洞） |
| C7 | `Schema="dbo", Table="User"` vs `Schema="other", Table="User"` | 兩個呼叫各自只回對應 schema 的欄位（pin schema filter `s.name = @sc`） |
| C8 | 資料行 `[Order]` 屬性是 INT 不是 BIGINT / object | `CAST(... AS INT)` 不被改 |
| C9 | `Schema=null, Table="User"` | 行為待 pin（目前 `s.name = @sc` 配 null param 會回空 list — characterize 並在註解標 quirk） |

**Helper**：在 fixture 上加 `InvokeGetColumns(string schema, string? table)`，內部用 DI 建一個 `TablesReadService`（吃 fixture 的 `ConnectionRegistry` + `NullLogger`），呼叫 `await svc.GetColumns(new TableTargetPayload { Uid = "test-mssql", Schema = schema, Table = table }, CancellationToken.None)`。

**驗收**：`dotnet test --filter "Category=mssql-container&FullyQualifiedName~GetColumns"` 全綠（Docker 可用時），SKIP（不可用時）。

---

### Phase 4 — 其餘 MSSQL endpoint 覆蓋（~2-3h）

按 ROI 排序，每個 endpoint 一個 test class，全部 `[Collection("mssql")]` 共用 container：

| Endpoint | Spec 檔 | 重點 case |
|----------|---------|----------|
| `GetIndexes` | `TablesReadService_GetIndexes_Mssql_Tests.cs` | PK 出現一筆、單欄 index、多欄 unique index 的 `Fields` 用 `,` 串接、reserved-word table 不炸 |
| `GetChecks` | `TablesReadService_GetChecks_Mssql_Tests.cs` | `CK_Region_CodeUpper` 的 `Clause` 含 `(upper([Code])=[Code])` 形式 |
| `GetCount` | `TablesReadService_GetCount_Mssql_Tests.cs` | `[dbo].[User]` 空表回 0、塞 3 筆後回 3、reserved-word 不炸 |
| `GetData` | `TablesReadService_GetData_Mssql_Tests.cs` | OFFSET / FETCH 分頁、`SortField=null` 時 fallback `ORDER BY (SELECT NULL)`、`SortField="Id"` 時 ASC/DESC、reserved-word column `[User]` 排序 |
| `GetOptions` | `TablesReadService_GetOptions_Mssql_Tests.cs` | `Comment="使用者主檔"`（table-level extended_property minor_id=0）、`AutoIncrement` 等於目前 IDENT_CURRENT、Engine/Collation 為空 |
| `GetDdl` | `TablesReadService_GetDdl_Mssql_Tests.cs` | view 用 `OBJECT_DEFINITION` 拿得到字串；**普通 table 在 MSSQL 上 `OBJECT_DEFINITION` 會回 NULL** → 預期 empty string（pin quirk） |
| `GetKeyUsage` / `GetForeignList` | `TablesReadService_GetKeyUsage_Mssql_Tests.cs` | `[UserAddress]` 的 outbound FK 一筆、shape 是 flat list（**不是** `{ inbound, outbound }`，CLAUDE.md gotcha #1 的對應守護）、`GetForeignList` 結果 `Equal` `GetKeyUsage`（pin alias） |
| `SearchColumns` | `TablesReadService_SearchColumns_Mssql_Tests.cs` | search="ema" 命中 `User.Email`、空 search 回空 list、SQL injection-style search 不炸 |

每個 class ~5–8 個 test，總計約 50–60 個 test。

---

### Phase 5 — CLAUDE.md 落字 + 收斂（~15 min）

1. **新增 `### Backend tests (xUnit)` 小節**（位置：在 `### Unit tests (Vitest)` 之後）：
   - 測試分類：`Category=unit` 純函式 / `Category=skeleton` 黑箱煙霧 / `Category=mssql-container` Docker-required
   - 跑法：`dotnet test`（全部）、`dotnet test --filter "Category!=mssql-container"`（CI fast lane）、`ANTARES_SKIP_MSSQL_CONTAINER=1`（強制 skip）
   - 為什麼 `mssql-container` 暫不進 merge gate（第一輪不擋人，等穩定再決定）
   - Container 起一次共用：`[Collection("mssql")]` + `MssqlContainerFixture`
2. **更新 `tests/integration-net/` row** 在 `### Source layout` 表格內：把目前的 8 specs 描述加上 `Tables/` 子目錄。
3. **更新 `### .NET sidecar gotchas` 第二條**：把 "0 test" 改成 "由 `TablesReadService_GetColumns_Mssql_Tests` 守護"，並指向新增的 `### Backend tests (xUnit)` 小節。

---

## Non-goals（明列避免 scope creep）

- **不**測 MySQL / PostgreSQL / SQLite 後端路徑。它們的等價 catalog query 也有 bug 風險，但本輪只動 MSSQL，避免單 PR 開到 4× container。
- **不**測 `ConnectionService.Connect/Test/Disconnect/ListDatabases`。那條線需要 SSH tunnel + connection pool lifecycle，獨立 plan。
- **不**測 `Schemas/SchemaTreeBuilder` 整棵 tree。需先把 4 種 client × N 種 object 的矩陣攤開，獨立 plan。
- **不**測 `Views/Triggers/Routines/Functions/Schedulers/Users` 各自的 read service。流量低，後排。
- **不**修任何 production code（characterization only）；發現 bug 用 quirk-pin + 註解 + 標 commit message `quirk:`。
- **不**把 `mssql-container` trait 接到 `test-build.yml` hard gate（第一輪靠手動 dispatch + 本機跑）。

## Risks

| Risk | Mitigation |
|------|-----------|
| Docker 在 dev 環境拉 image 太慢（~600 MB） | 第一次跑前先手動 `docker pull mcr.microsoft.com/mssql/server:2022-latest`；CI 預期靠 layer cache |
| SQL Server container 在 Apple Silicon 上要 emulator | 接受 ~2x 慢；Phase 2 fixture 加 `WithEnvironment("ACCEPT_EULA", "Y")` 並文件化 |
| Testcontainers 3.10 對 .NET 10 preview API 有相容性問題 | 預先在 Phase 2 第一步單獨跑 smoke test；fallback 3.9 line |
| Internal helpers 測試需要 `InternalsVisibleTo` | 單行 csproj 改動，不改演算法，風險低 |
| Future SQL Server 版本（2025+）對 `IDENT_CURRENT` / `OBJECT_DEFINITION` 行為改變 | image tag 鎖 `2022-latest`，升級時當顯式決定處理 |

## Acceptance criteria

- [ ] Phase 1 完成：Helpers 測試 12+ case 全綠 < 1s（無 Docker 也能跑）
- [ ] Phase 2 完成：`MssqlContainerFixture` smoke test 在 Docker 可用環境綠燈、無 Docker 環境 SKIP
- [ ] Phase 3 完成：`GetColumns` 9 case 全綠（Docker 可用時）
- [ ] Phase 4 完成：其餘 8 endpoint 50+ case 全綠（Docker 可用時）
- [ ] Phase 5 完成：CLAUDE.md 新增 `### Backend tests (xUnit)` 小節、`tests/integration-net/` 描述更新、gotcha #2 加守護指引
- [ ] `dotnet test tests/integration-net/Server.IntegrationTests.csproj` 在本機（Docker 開）整個跑完不超過 60s
- [ ] 0 production code 變更（除了 `internal` 可見度 + `InternalsVisibleTo`）

## Out-of-band

- 本計畫產出**不**動 frontend、不動 vitest 配置、不動 CI workflow（除了 Phase 5 的 docs）。
- 完整一輪做完後，下一個自然延伸是 `ConnectionService` 的 envelope 行為測試，再來才是 `Schemas/SchemaTreeBuilder` 全面覆蓋。那兩個獨立開 plan。
