# Zephsite decisions

A running log of settled decisions, newest first. Each entry says what was
decided, why, and what would reopen it.

## 2026-10-30 · Monitor architecture approved; both tracks in parallel; Zephyr

- Decided by: owner.
- Monitor architecture approved as proposed. Spec:
  `docs/superpowers/specs/2026-10-30-claude-code-monitor-design.md`
  (awaiting owner review before implementation planning).
- Build order: monitor and public website advance together.
- Public site visual direction: Zephyr (calm, light Onest type, slow wind-line
  field in the existing teal). Website design itself still to be proposed.

## 2026-10-30 · Live Claude Code monitor is a priority feature

- Decided by: owner.
- The monitor shows Claude Code usage live while sessions run, plus history.
- Built as a separate local companion service; the website never reads local
  files from browser JavaScript.
- Raw transcripts, prompts, responses, tool calls and credentials never leave
  the computer by default.
- All cost figures are labelled API-equivalent estimates.
- Research: `docs/research/2026-10-30-claude-code-telemetry.md`.
- Architecture: proposed, awaiting approval. Proposal page (private
  artifact): https://claude.ai/artifact/7PWNa814twYQQQDgqXxTSx

## 2026-10-30 · Public site is a premium personal website, not a themed app

- Decided by: owner (direction correction after the first concept board).
- No operating-system, fake-terminal or command-line theme on the public site.
- Public site and private dashboard are distinct experiences. Complex controls
  and analytics live only in the dashboard.
- Visual direction: still open. Candidates Zephyr (recommended), Folio and
  Veil on the concept board (private artifact, version 2):
  https://claude.ai/artifact/KvsSuFEm2kePkPFqo8z25v
