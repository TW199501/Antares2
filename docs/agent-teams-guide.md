# Agent Teams 實戰指南(Antares2)

> 官方多代理協作功能的安裝、語法、執行順序、品質閘與排錯。整理自官方文件
> ([Agent Teams](https://code.claude.com/docs/en/agent-teams) ·
> [Subagents](https://code.claude.com/docs/en/sub-agents))。
> 本機已驗證 Claude Code **2.1.177**(Agent Teams 需 ≥ 2.1.32 ✓)。

## 0. 何時用 / 何時不用

| 用 Agent Teams | 用 Subagent / 單一 session |
|---|---|
| 研究與**審查**、整個後端稽核 | 順序型、有大量相依的工作 |
| **對抗式除錯**(多假設互相反駁找 root cause) | 改同一個檔案(會互相覆蓋) |
| 新模組 / 跨層(前端+後端+測試各一人) | 只要「結果」、不需代理間討論 → 用 subagent |

代價:**token 比單一 session 高很多**(每個 teammate 是獨立 Claude)。官方建議 **3–5 個 teammate**、每人 5–6 個 task。

**Subagent vs Agent Team 一句話**:subagent 只回報主代理、彼此不講話;agent team 的 teammate **共享 task list、互相傳訊、自我協調**。

---

## 1. 安裝與啟用(從哪開始)

三步:

```jsonc
// (1) 啟用 Agent Teams —— 預設關閉,實驗性。寫進 .claude/settings.json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

```jsonc
// (2) Windows 必設:split-pane 需要 tmux/iTerm2,「不支援 Windows Terminal / VS Code 終端」
//     → 用 in-process 模式(任何終端都能跑)。寫進 ~/.claude/settings.json
{
  "teammateMode": "in-process"
}
// 也可單次:claude --teammate-mode in-process
```

```text
(3)(選用,但推薦)在 .claude/agents/ 定義可重用的角色(見 §2),
    起 team 時用「用 <agent type> 這個角色 spawn teammate」即可。
```

> 啟用後**不會自動開 team**——你要主動叫,或 Claude 判斷該平行時提議(都要你確認)。

---

## 2. 語法速查

### 2a. Subagent 定義檔(`.claude/agents/<name>.md`,進版控)

```markdown
---
name: backend-auditor          # 必填:識別名(全樹唯一)
description: 何時該派它(Claude 依此自動委派,也用於團隊角色)
tools: Read, Grep, Glob, Bash  # 選填:限制工具(稽核員給 read-only 最佳);省略=繼承全部
model: sonnet                  # 選填:haiku / sonnet / opus(便宜工作路由 haiku)
---

（系統提示 body:角色、要找什麼、規則、輸出格式…）
```
- 當作 team teammate 用時:沿用該定義的 `tools` 與 `model`,body **附加**到 teammate 系統提示(不取代);`SendMessage` 與 task 工具一定可用。
- **注意**:teammate 模式下,定義裡的 `skills` / `mcpServers` frontmatter **不生效**(teammate 從專案/使用者設定載 skills 與 MCP)。

### 2b. 起 team / 控制 team(對 lead 講自然語言)

```text
# 起 team(描述任務 + 結構)
Create an agent team to <任務>. Spawn N teammates: 一人 X、一人 Y、一人唱反調.

# 指定數量/模型
Create a team with 4 teammates ... Use Sonnet for each teammate.

# 用既有 subagent 角色當 teammate
Spawn a teammate using the backend-auditor agent type to audit server/Tables/.

# 要求先計畫再動手(teammate 進 read-only plan mode,lead 核准才實作)
Spawn an architect teammate ... Require plan approval before they make any changes.

# 直接跟某 teammate 對話:in-process 用 Shift+Down 切換後輸入
# 關閉某 teammate
Ask the researcher teammate to shut down
# 收尾(一定用 lead 收)
Clean up the team
```

---

## 3. 執行順序(生命週期)

```
啟用(settings) 
  → 你下任務 + 要求建 team(你確認)
  → lead 建 team:產生 shared task list + mailbox,spawn teammates(各自獨立 context,載 CLAUDE.md/MCP/skills,不繼承 lead 對話)
  → teammates 認領 task(file-lock 防搶)/ lead 指派
  → 各自獨立工作,互相傳訊/反駁,完成的 task 解鎖相依 task
  → teammate idle 自動通知 lead
  → lead 彙整(synthesize)
  → Clean up the team(lead 執行)
```
- task 狀態:pending → in progress → completed;可有相依(相依未完成不能認領)。
- 儲存在 `~/.claude/teams/{team}/config.json`、`~/.claude/tasks/{team}/`(自動產生,**勿手改**,team 結束即刪)。

---

## 4. 標準工作流:寫 → 單元測試 → 修 → 檢查(用 hooks 強制)

「寫完一定跑單元測試、過了才算完成」這種品質閘,用 **hooks** 強制(exit code 2 = 擋下並回饋):

| Hook | 觸發時機 | 用途(exit 2 擋) |
|---|---|---|
| [`TaskCreated`](https://code.claude.com/docs/en/hooks#taskcreated) | task 建立時 | 擋掉不合規的 task |
| [`TaskCompleted`](https://code.claude.com/docs/en/hooks#taskcompleted) | task 要標記完成時 | **跑 `dotnet test` / `pnpm lint`,沒過就 exit 2 → 不准標完成 + 回饋** |
| [`TeammateIdle`](https://code.claude.com/docs/en/hooks#teammateidle) | teammate 要 idle 時 | 還有事沒做就 exit 2 把它叫回去繼續 |

加上 **plan approval**(teammate 先計畫、lead 核准才動手)。對 lead 給準則影響核准,例如「只核准含測試覆蓋的計畫」「拒絕改 DB schema 的計畫」。

**對應到本專案的標準收尾**(我們這 session 建立的):每個 teammate 實作 → 自驗(`dotnet build` 0 error + `dotnet test` Category=unit 全綠 + `pnpm lint` 0 error)→ 回報證據 → lead 彙整 → 你審。配 `TaskCompleted` hook 可機械強制這一條。

---

## 5. 失敗怎麼辦(troubleshooting)

| 症狀 | 處理 |
|---|---|
| teammate 沒出現 | in-process 按 **Shift+Down** 切換看;任務可能不夠複雜(Claude 自行判斷要不要 spawn);split-pane 要 `which tmux` / it2 |
| permission prompt 太多 | 先在 permissions 設定**預先核准**常用操作再 spawn |
| teammate 遇錯就停 | 直接給它指令繼續,或 spawn 一個替補接手 |
| lead 太早收工 / 自己動手 | 「Wait for your teammates to complete...」/「keep going」 |
| task 卡住(狀態沒更新) | 手動更新 task 狀態,或叫 lead 去 nudge |
| 殘留 tmux session | `tmux ls` → `tmux kill-session -t <name>` |

---

## 6. 限制(實驗性,要知道)

- **in-process teammate 不能 resume**:`/resume`、`/rewind` 不會還原;resume 後叫 lead 重新 spawn。
- **一次一個 team**;**不能巢狀**(teammate 不能再開 team);**lead 固定**不能轉移。
- 權限在 spawn 時定(全 teammate 繼承 lead 權限模式;spawn 後可個別改)。
- split-pane 需 tmux/iTerm2(VS Code 終端、Windows Terminal、Ghostty 不支援)→ Windows 用 in-process。

---

## 7. 這個專案:後端稽核怎麼起(具體)

1. `.claude/settings.json` 加 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`(+ `~/.claude/settings.json` 設 `teammateMode: in-process`)。
2. `.claude/agents/` 建 read-only 稽核員:
   - `backend-auditor`(tools: Read, Grep, Glob, Bash;查契約漂移 / null·例外 / SQL injection / 方言 / `[NonUnify]` / 資源洩漏)
   - `dead-code-finder`(找未用 / 多餘)
   - `contract-verifier`(renderer↔後端 wire 契約 vs `tests/fixtures/contract/`)
3. 起 team:
   ```text
   Create an agent team to audit the entire .NET backend (server/). Spawn 3-5
   teammates using the backend-auditor / dead-code-finder / contract-verifier
   agent types, each owning a different service group (Connections / Schemas /
   Tables / Views·Triggers·Routines·Functions / Users·Infrastructure·WebSockets).
   Have them message each other to challenge findings (adversarial). Synthesize a
   deduped report: Critical / Important / Minor + dead code.
   ```
4. 收尾:`Clean up the team`。

> 備註:本環境另有 `Workflow` 工具(決定論腳本式編排,先前 SqlSugar 35-agent 用的就是它)。
> Agent Teams 是**官方互動式對等版本**;兩者都能吃同一套 `.claude/agents/` 定義。
