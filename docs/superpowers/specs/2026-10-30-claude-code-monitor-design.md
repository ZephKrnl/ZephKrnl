# Live Claude Code monitor: design spec

- Status: draft for owner review
- Date: 2026-10-30
- Architecture approved by the owner on 2026-10-30
  (proposal page: https://claude.ai/artifact/7PWNa814twYQQQDgqXxTSx)
- Research this spec relies on: `docs/research/2026-10-30-claude-code-telemetry.md`

## 1. Goal

Show Claude Code token usage while sessions are running, with about one second
of delay after Claude Code reports each API request, plus a full usage history.
It runs privately for the owner on Windows, first on the same PC (local mode),
later from any device (remote mode).

The monitor is part of the private dashboard. It never appears on the public
site except, later and only if the owner opts in, as daily totals.

## 2. Scope

In scope for this spec (milestones M1 to M3):

- A shared, platform-independent TypeScript library (`lib/monitor-core`).
- A Windows companion program (`desktop/zeph-companion`) that collects,
  stores and serves usage data on `127.0.0.1`.
- A React dashboard package (`lib/monitor-ui`) served by the companion in
  local mode and reused by the website's admin dashboard later.
- Live view, history views, session and project comparisons, exports.

Defined only as an interface here, specified with the website server (M4):

- Remote mode: pairing, signed uploads, server storage, live stream to the
  website dashboard.

Out of scope:

- Any estimate of tokens before Claude Code reports them.
- Reading or storing prompt, response or tool content.
- macOS and Linux packaging. The code stays portable and is tested on Linux,
  but only Windows gets an installer and autostart.

## 3. Requirements

### 3.1 Metrics

| Metric | Panel | Source |
| --- | --- | --- |
| Session input, output, cache-read, cache-write tokens; total | Session | Telemetry `api_request`, summed per session |
| Estimated API-equivalent cost | Session | Telemetry `cost_usd`; transcript history priced from a table |
| Active model | Session | Status line `model.id`, `PostModelSwitch` hook, latest `api_request` model |
| Current project | Session | Status line `workspace.project_dir`, else first hook `cwd` |
| Session duration | Session | Status line `cost.total_duration_ms`, ticked locally |
| Current activity and since when | Session | Hooks |
| Last update time | Session | Companion clock |
| Context-window used %, size, current usage | Context | Status line `context_window.*` |
| 5-hour and 7-day limit %, reset times | Plan limits | Status line `rate_limits.*` |
| Daily, weekly, monthly usage; trends | History | Ledger |
| Session history; project and model comparisons; token-type breakdown | History | Ledger |

Session usage, context window, plan limits and history are separate panels
with separate labels. They are never added together.

### 3.2 Live behaviour

- R1. Token totals change once per completed API request. Between requests the
  activity line says what Claude is doing, with no token number.
- R2. From the moment Claude Code's telemetry export reaches the companion to
  the dashboard update: under 100 ms at the 95th percentile on the owner's PC.
- R3. End to end, from request completion to dashboard: about 1 to 1.5 s, set
  by Claude Code's 1000 ms export interval.
- R4. Several Claude Code sessions at once are tracked separately and shown
  side by side.
- R5. A session's plan limits are account-wide: the dashboard shows the most
  recent report from any session, with its observation time, and hides a
  window after its `resets_at` passes.
- R6. No manual refresh. The dashboard reconnects on its own and resyncs from
  a snapshot.

### 3.3 Accuracy

- A1. Each API request is stored once, whatever sources report it.
- A2. Restarting the companion never duplicates usage.
- A3. If the companion was not running, usage for that time is recovered from
  transcripts where possible, and the gap is shown.
- A4. For a session fully covered by telemetry, the summed cost matches
  Claude Code's own `cost.total_cost_usd` within 1% or $0.01. A mismatch shows
  a warning, not a silent correction.
- A5. Unknown or malformed input is skipped and counted, never guessed.
- A6. Every cost figure is labelled "API-equivalent estimate". The owner's real
  plan price, if entered, is shown separately and never mixed into estimates.

### 3.4 Privacy and security

- P1. Raw transcripts, prompts, responses, tool inputs and outputs, file
  contents, file paths outside the local dashboard, credentials, the owner's
  email and account IDs never leave the PC.
- P2. Claude Code's content logging variables (`OTEL_LOG_USER_PROMPTS`,
  `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`,
  `OTEL_LOG_TOOL_CONTENT`, `OTEL_LOG_RAW_API_BODIES`) are never set.
- P3. The companion opens Claude Code's files read-only. The only write to
  Claude Code configuration is the installer's edit of user settings, with
  consent, a backup and an exact undo.
- P4. The companion listens on `127.0.0.1` only and requires a token on every
  request.

## 4. Architecture

```
Claude Code session(s)
  ├─ telemetry logs (OTLP/HTTP JSON) ─┐
  ├─ HTTP hooks ──────────────────────┤  127.0.0.1:47821, bearer token
  ├─ status line script ──────────────┤
  └─ files (read-only): transcripts, sessions/ ─┐
                                                 ▼
                         zeph-companion (Node, Windows)
                         receivers → normalizer → ledger (SQLite)
                                                 → live hub (SSE)
                                                 → local dashboard (monitor-ui)
                                                 → [M4] outbox → website server
```

### 4.1 `lib/monitor-core` (pure TypeScript, no I/O)

One purpose: turn raw inputs into typed records and decide how records
combine. Fully unit-tested, used by the companion and later by the website
server.

- `schemas`: zod schemas for the companion's inputs and outputs.
- `parse/otlp`: OTLP/HTTP JSON logs body → `UsageRecord[]` and
  `ApiProblem[]` (from `api_request`, `api_error`, `api_refusal`,
  `api_retries_exhausted`), `PromptMark[]` (from `user_prompt`, content
  ignored), `CompactionMark[]`. All other events dropped. Identity attributes
  (`user.email`, `user.account_uuid`, `user.account_id`, `organization.id`,
  `user.id`) dropped.
- `parse/hook`: hook body → `ActivityEvent` and session lifecycle changes.
- `parse/statusline`: status line JSON → `SessionSnapshot` (context window,
  rate limits, cost, duration, model, project dir, session name, version).
- `parse/transcript`: one JSONL line → `UsageRecord | null`. Only lines with
  `type: "assistant"` and a `message.usage` object yield a record. Unknown
  shapes return `null` and a reason code.
- `ledger`: the merge rules in section 5 as pure functions, plus an in-memory
  reference implementation used by tests.
- `aggregate`: roll-ups by session, project, model, day, ISO week, month, in
  the owner's time zone.
- `pricing`: rates per million tokens by model, with per-model 5-minute and
  1-hour cache-write rates; owner overrides; ported from claude-code-stats
  (MIT) with its licence notice kept.

### 4.2 `desktop/zeph-companion` (Node 22.13 or later)

- HTTP server on `127.0.0.1:47821` using `node:http` (no web framework).
  - `POST /v1/logs`: OTLP/HTTP JSON receiver. Validates the body, responds
    `200 {}`, then applies the records to the ledger.
  - `POST /v1/hooks`: hook receiver. Always responds `200` with an empty
    body, so it never alters Claude Code's behaviour.
  - `POST /v1/statusline`: status line receiver. Responds with the status
    line text to print.
  - `GET /v1/stream`: Server-Sent Events for the dashboard.
  - `GET /v1/snapshot`, `GET /v1/history/*`, `GET /v1/export/*`: dashboard
    data.
  - `GET /` and static assets: the built `monitor-ui` dashboard.
  - `GET /auth?code=…`: one-time dashboard sign-in (section 8).
- Watchers:
  - `~/.claude/sessions/*.json`: running sessions, their `cwd` and busy or
    idle status. Fields are read defensively; the schema is undocumented.
  - `~/.claude/projects/**/*.jsonl`, including `subagents/`: tailed for new
    lines with saved cursors; full scan on first run for history.
  - `fs.watch` plus a rescan every 5 s as a safety net.
- Store: SQLite through `node:sqlite`, behind a `Store` interface so
  `better-sqlite3` can replace it if `node:sqlite` causes problems. Database at
  `%LOCALAPPDATA%\Zephsite\companion\ledger.db`.
- Live hub: applies records, recomputes affected session totals, emits SSE
  events (section 6).
- CLI: `zeph-companion setup | uninstall | start | open | status | doctor`.
- Runs hidden at login through a per-user startup entry (no administrator
  rights, no Windows service). The exact hidden-launch method is chosen and
  verified on Windows during M2.

### 4.3 `lib/monitor-ui` (React)

- Views: Live, History, Sessions, Projects, Settings.
- Charts are small SVG components in this package. No chart library in M2;
  if History needs more in M3, the choice is recorded in `docs/decisions.md`.
- Visual language: the design shown on the proposal page. Graphite surfaces,
  large tabular numerals, one hue per token type, no decorative animation;
  numbers update in place.
- Talks to a `MonitorClient` interface with two implementations: companion
  (local mode) and website server (M4).

## 5. Data model and merge rules

### 5.1 Tables

- `requests`: `request_key` (primary key), `request_id`, `client_request_id`,
  `session_id`, `prompt_id`, `ts`, `model`, `query_source` (main, subagent,
  auxiliary), `agent_id`, `input`, `output`, `cache_read`, `cache_write_5m`,
  `cache_write_1h`, `cache_write`, `cost_usd`, `cost_source` (claude_code,
  price_table), `duration_ms`, `source` (otel, transcript), `speed`, `effort`.
- `sessions`: `session_id`, `project_key`, `name`, `first_seen`, `last_seen`,
  `ended_at`, `end_reason`, `model`, `cc_version`, `status`, `activity`,
  `activity_since`, `ctx_used_pct`, `ctx_size`, `ctx_tokens`, `cc_cost_usd`,
  `duration_ms`, `telemetry_seen`, `transcript_path`.
- `projects`: `project_key`, `path`, `label`.
- `limits`: `window` (five_hour, seven_day), `used_pct`, `resets_at`,
  `observed_at`, `session_id`.
- `transcript_cursors`: `path`, `size`, `mtime`, `offset`.
- `skipped`: counts of skipped inputs by source, reason and Claude Code
  version.
- `meta`: schema version and settings.

### 5.2 Request identity

- Telemetry: `request_id`, else `client_request_id`, else a hash of
  `session.id`, `event.timestamp`, `model` and the four token counts.
- Transcript: `requestId`, else `message.id`.
- Telemetry `request_id` equals transcript `requestId` in Claude Code 2.1.314.
  The docs call this join version-specific, so a test with real captured data
  guards it.

### 5.3 Merge rules

- M-a. A transcript record never overwrites a telemetry record.
- M-b. A telemetry record replaces a transcript record with the same key.
  (Verified with `node:sqlite` as a conditional upsert.)
- M-c. Transcript lines with the same key are one request: the first complete
  line is stored, the rest are ignored. Their usage is identical.
- M-d. Applying any record twice leaves the ledger unchanged.
- M-e. A session with transcript records but no telemetry is marked
  "transcript-only". Background calls are missing for it, and the dashboard
  says so.

### 5.4 Projects

- `project_key` is the normalised `workspace.project_dir` from the status
  line, else the first `cwd` from hooks. The label defaults to the folder
  name. The full path is shown only in the local dashboard.

## 6. Live updates

- SSE event types: `snapshot` (sent on connect and after a reconnect),
  `request` (new record plus updated session totals), `session` (state,
  activity, context, model), `limits`, `skipped`, `heartbeat` every 15 s.
- Activity states from hooks: `responding` (after prompt submit or tool
  finish), `tool:<name>` (pre tool use), `subagent:<type>`, `compacting`,
  `waiting` (notification), `idle` (stop), `error` (stop failure), `ended`.
- The dashboard shows the time of the last event and a "connection lost"
  state after 30 s without a heartbeat.

## 7. Claude Code configuration (installer)

`zeph-companion setup`:

1. Reads `%USERPROFILE%\.claude\settings.json`, builds the new version and
   prints a readable diff.
2. Stops unless the owner confirms.
3. Writes a timestamped backup next to the file, then the new file.
4. Adds:
   - `env`: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_LOGS_EXPORTER=otlp`,
     `OTEL_METRICS_EXPORTER=none`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`,
     `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:47821/v1/logs`,
     `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>`,
     `OTEL_LOGS_EXPORT_INTERVAL=1000`.
   - `hooks`: one HTTP hook entry (timeout 2 s, `Authorization` header with
     the literal token) for `SessionStart`, `SessionEnd`,
     `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
     `Stop`, `StopFailure`, `Notification`, `SubagentStart`, `SubagentStop`,
     `PreCompact`, `PostCompact`, `PostModelSwitch`, `CwdChanged`. Existing
     hooks are kept.
   - `statusLine`: `node C:/Users/<user>/.zephsite/statusline.mjs`. If a
     status line already exists, its command is saved and the script runs it
     and prints its output, so the owner's status line looks the same.
5. Refuses to proceed and explains why if any telemetry variable is already
   set to another destination, or if managed settings control telemetry.

`zeph-companion uninstall` removes exactly what setup added and verifies the
result against the backup.

The token is never put in a plain `env` variable of its own, because Claude
Code passes `env` values to every subprocess. `OTEL_*` variables are removed
from subprocesses by Claude Code.

The status line script posts the JSON with a 300 ms timeout and prints the
companion's reply. On failure it prints a short fallback built from the JSON
itself (folder, model, context %).

## 8. Security

- Listens on `127.0.0.1` only.
- 256-bit random token, stored in
  `%APPDATA%\Zephsite\companion\config.json`, readable by the owner's account
  only. Required as a bearer token on every ingest and data endpoint.
- Host header must be `127.0.0.1:47821` or `localhost:47821` (blocks DNS
  rebinding). Any request with an `Origin` header other than the companion's
  own is refused. No CORS headers are ever sent.
- Dashboard sign-in: `zeph-companion open` creates a one-time code valid for
  60 s and opens the browser at `/auth?code=…`, which sets an `HttpOnly`,
  `SameSite=Strict` session cookie.
- Request bodies are capped at 2 MB and validated with zod.
- Logs never contain request bodies or the token.

## 9. Errors and resilience

- Companion stopped: Claude Code continues. Hooks fail as non-blocking errors;
  telemetry exports fail and are not retried by the companion; transcripts
  fill the gap on restart (rule M-e marks the coverage).
- Partial transcript line at the end of a file: the cursor stops before it.
- File replaced or shortened: the cursor resets and the file is rescanned;
  merge rules prevent duplicates.
- Clock: timestamps come from Claude Code's events; the companion clock is
  used only for "last update".
- Claude Code version change: unknown shapes go to `skipped` with the version,
  shown in Settings so a format change is visible.

## 10. Testing and acceptance

Tests use Vitest, added as a development dependency.

- Unit tests in `monitor-core` for every parser, with fixtures:
  - status line and hook payloads from the documented examples;
  - transcript lines derived from a real session, reduced to identifiers and
    usage fields, content removed;
  - telemetry bodies captured from a real Claude Code run, with the owner's
    permission (see section 12).
- Property tests: applying a random sequence of records twice, or in another
  order, or with transcript and telemetry swapped, gives the same ledger.
- Companion integration tests: start on a free port, post fixtures, assert SSE
  frames and stored rows; restart mid-stream and assert unchanged totals;
  check host, origin and token rejections.

| Milestone | Done when |
| --- | --- |
| M1 core | Unit and property tests pass in CI; replaying a real session's records reproduces Claude Code's session cost exactly. |
| M2 companion | On the owner's PC: each finished request appears within about 1.5 s; two sessions show side by side; restarting the companion mid-session changes no totals; uninstall restores the settings file byte for byte. |
| M3 history | Totals for a past period match a hand-checked sample; CSV and JSON exports open cleanly in a spreadsheet. |

Windows-only checks (autostart, hidden launch, Git Bash versus PowerShell
status line) run on the owner's PC from a written checklist, because this
development environment is Linux.

## 11. Remote mode interface (for M4)

- The owner pairs a device in the signed-in website dashboard and receives a
  one-time device secret.
- The companion keeps an outbox of records and session snapshots and posts
  batches to `/api/monitor/ingest` with headers for device ID, timestamp and
  an HMAC-SHA256 signature over timestamp and body.
- The server rejects bad signatures, timestamps more than 5 minutes off and
  repeated batch IDs, upserts by `request_key`, and streams changes to the
  signed-in dashboard over SSE.
- Uploaded fields: those listed on the proposal page under "What remote mode
  sends". Never the fields in P1.
- Full design goes in the website server spec.

## 12. Open questions

- Q1. Project labels in remote mode: folder name, owner-chosen alias, or an
  anonymous code. Recommended: folder name. Not needed until M4.
- Q2. Permission to run one short real `claude -p` session in the development
  environment, with telemetry pointed at a test companion, to capture
  fixtures. It uses a small amount of the owner's plan usage. Needed for M1's
  telemetry fixtures; without it, fixtures come from the owner's PC in M2.
