# Claude Code telemetry: what can be monitored live

Research for the Zephsite live usage monitor. Checked on 2026-10-30 against the
official docs at `code.claude.com/docs/en/*.md` and a real Claude Code 2.1.314
installation. Claude Code changes often; re-check the linked pages before
relying on a detail marked "version-specific".

## Summary

No single interface exposes everything. Three documented interfaces together
cover every metric the monitor needs:

| Interface | Documented contract? | Fires | Gives us |
| --- | --- | --- | --- |
| OpenTelemetry logs, `claude_code.api_request` event | Yes (`monitoring-usage`) | Once per completed API request, exported every `OTEL_LOGS_EXPORT_INTERVAL` ms (default 5000, can be 1000) | Exact per-request `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens` (+ 5m/1h split), `cost_usd`, `model`, `duration_ms`, `request_id`, `session.id`, `prompt.id`, `query_source` (main / subagent / auxiliary), `agent_id` |
| Status line command (JSON on stdin) | Yes (`statusline`) | Session start, each new assistant message (300 ms debounce), `/compact`, optional `refreshInterval` timer (min 1 s) | `context_window.*` (size, used %, `current_usage`), `rate_limits.five_hour` / `seven_day` (`used_percentage`, `resets_at`), `cost.total_cost_usd`, `cost.total_duration_ms`, `model.id`, `workspace.project_dir`, `session_id`, `session_name`, `prompt_cache.*`, `version` |
| Hooks (`type: "http"` posts JSON to a URL) | Yes (`hooks`) | Real time on lifecycle events | `SessionStart`, `UserPromptSubmit`, `PreToolUse`/`PostToolUse` (tool name), `Stop`, `StopFailure`, `SubagentStart`/`Stop`, `PreCompact`/`PostCompact`, `PostModelSwitch`, `CwdChanged`, `SessionEnd` (reason); every event carries `session_id`, `cwd`, `transcript_path` |

Two file-based sources fill gaps:

| Source | Contract | Use |
| --- | --- | --- |
| `~/.claude/projects/<project>/<session>.jsonl` (+ `<session>/subagents/`) | Location documented; **entry format is internal and changes between versions** (`sessions` page) | History backfill, and recovery when the companion was not running. Never the primary live source. |
| `~/.claude/sessions/<pid>.json` | Existence documented ("one small file per running session, used to detect concurrent sessions and crashes", removed on exit); schema undocumented | Detect running sessions and their `cwd` and busy/idle status. Treat fields as best-effort. |

## What is live, and what is not

- **Token counts update per completed API request, never mid-stream.** No
  interface reports tokens while a response is still streaming. An agentic turn
  makes many requests (one per tool round-trip), so totals move every few
  seconds while Claude works. The monitor must show "responding" without numbers
  between requests and must not estimate.
- **Latency:** OTel log export interval set to 1000 ms gives roughly 1 s from
  request completion to the companion. Status line adds a 300 ms debounce.
  Hooks arrive immediately.
- **Status line has no running token totals.** Its `context_window` numbers are
  the size of the current context from the latest response, not cumulative
  usage. Cumulative session tokens must come from `api_request` events.
- **Context window %** is input-only:
  `input + cache_creation + cache_read` over `context_window_size`. Null before
  the first response and right after `/compact`.
- **Plan limits** (`rate_limits.five_hour`, `rate_limits.seven_day`) appear only
  for claude.ai Pro, Max and Ultra subscribers, only after the session's first
  API response, each window independently optional, and dropped once
  `resets_at` passes. They are account-level, not per-session.
- **Cost** (`cost_usd`, `cost.total_cost_usd`) is Claude Code's client-side
  estimate at list price. It is an API-equivalent estimate, not a bill.

## Transcript format observations (version-specific, 2.1.314)

From a real session file:

- One API response is written as **several lines, one per content block**
  (thinking, text, tool_use), all sharing `message.id` and `requestId` and all
  carrying the **same final `message.usage`**. Summing per line overcounts.
  Deduplicate by `requestId` (fall back to `message.id`).
- `message.usage` holds `input_tokens`, `output_tokens`,
  `cache_read_input_tokens`, `cache_creation_input_tokens`, and
  `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`.
- Background calls (for example Haiku session-title generation) do not appear
  as assistant entries. A `cost-state` entry holds per-model session totals that
  do include them. It is internal; use only as a cross-check.
- OTel `request_id` matches transcript `requestId` (the docs call this join
  version-specific).

## Pricing spot check

For one real session, Opus 5.5 usage of 539 input, 52,340 output, 2,545,970
cache-read and 152,693 one-hour cache-write tokens, priced with the
claude-code-stats table ($4 / $20 / $0.20 / $8 per million), gives
$2.779694. Claude Code's own `cost-state` figure for the same usage is
$2.779694. The table is usable for transcript-only history where no
`cost_usd` exists.

## Configuration constraints

- Telemetry variables (`CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*_EXPORTER`,
  `OTEL_EXPORTER_OTLP_*`) are **ignored in project and local settings**. They
  must be set in user settings (`~/.claude/settings.json` `env` block), managed
  settings, or the launch environment. User-settings `env` applies at startup.
- `OTEL_EXPORTER_OTLP_PROTOCOL` has no default; set `http/json` so the
  companion needs no protobuf/gRPC stack.
- Content stays redacted by default: prompts, responses and tool details are
  only exported if `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES` or
  `OTEL_LOG_TOOL_DETAILS` are enabled. The monitor never enables them.
- Standard OTel attributes include `user.email` and account IDs. The companion
  must drop them at ingest.
- HTTP hooks: connection failure or non-2xx is a non-blocking error, so a
  stopped companion never blocks Claude Code. Default `onFailure` is
  `continue`; keep it.
- `SessionEnd` hooks share a 1.5 s budget.
- Windows: status line commands run through Git Bash if installed, otherwise
  PowerShell. Use forward slashes in paths, for example
  `node C:/Users/<you>/.zephsite/statusline.mjs`.
- Claude Code deletes transcripts older than `cleanupPeriodDays` (default 30).
  The companion keeps its own ledger so history survives.

## Sources

- https://code.claude.com/docs/en/statusline.md
- https://code.claude.com/docs/en/monitoring-usage.md
- https://code.claude.com/docs/en/hooks.md
- https://code.claude.com/docs/en/settings-reference.md
- https://code.claude.com/docs/en/claude-directory.md
- https://code.claude.com/docs/en/sessions.md
- https://code.claude.com/docs/en/costs.md
- https://github.com/AeternaLabsHQ/claude-code-stats (MIT, v1.3.0) for prior
  art on transcript parsing and pricing.
