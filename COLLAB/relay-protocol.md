# Collaborative Turn Protocol

This repository now supports a two-agent workflow where **Codex** and **Claude Code** take alternating turns without human prompting. Both agents share the same workspace, so they can coordinate via simple files inside `COLLAB/`.

## Core Files

| File | Purpose |
|------|---------|
| `COLLAB/TURN.json` | Semaphore + task description that tells the next agent it's their turn. |
| `COLLAB/notes.md` | Running log of findings/fixes/next steps so each agent knows the current context. |
| `COLLAB/relay-protocol.md` | (This file) Definition of the process—both agents should read it before acting. |

### TURN.json structure

```jsonc
{
  "turn_id": 7,              // Increment every time the baton passes.
  "current": "codex",        // "codex" or "claude"
  "task": "describe_next_issue",
  "notes": "Checked rejoin flow; awaiting fixes.",
  "updated_at": "2025-12-13T21:15:00Z"
}
```

Rules:
1. The agent whose name appears in `current` owns the next action.
2. After finishing, that agent updates:
   - `turn_id` (increment by 1),
   - `current` (set to the other agent),
   - `task`/`notes` (brief instruction for the next step),
   - `updated_at`.
3. Always re-read the file immediately before writing to avoid stomping another agent’s update. If the file changed mid-run (turn_id no longer matches what you read), abort and re-check.

### notes.md structure

Keep it lightweight but structured, e.g.

```
## Session Log
1. [Codex | 21:05Z] Identified ghost endGame issue. → Claude fix & test.
2. [Claude | 21:20Z] Patched removePlayer guard, tests passed. → Codex re-audit timers.
```

Both agents append entries chronologically. Include timestamps and the follow-up instruction.

## Workflow

1. **Check Turn:** Each agent polls `TURN.json`. If it’s not your name, do nothing.
2. **Execute Task:** Perform the requested analysis/fix/tests described in `task`/`notes`.
3. **Log Outcome:** Append a concise bullet/numbered entry to `COLLAB/notes.md` describing what you did and what’s next.
4. **Pass Baton:** Update `TURN.json` (increment `turn_id`, switch `current`, set next `task`, add timestamp).
5. **Optionally run tests** if the task involved code changes; include results in `notes.md`.

## Special Cases

- **Room reset / blocked state:** If you detect that the repo is waiting on human input (e.g., merge conflicts), set `current` to `human` and describe the blocker in `task`.
- **Automated scripts:** If you add helper scripts (e.g., `scripts/next-task.sh`), document them here and reference them in `notes`.

## How to Start the Loop

1. **Create TURN.json** with `current` set to the agent you want to act first, e.g.
   ```json
   {
     "turn_id": 1,
     "current": "codex",
     "task": "initial_deep_dive",
     "notes": "Fresh start. Identify top blocking issues.",
     "updated_at": "2025-12-13T21:30:00Z"
   }
   ```
2. **Notify both agents** (Codex and Claude Code) that the protocol file exists and they should obey it.
3. Each agent runs in its own terminal session. They simply loop:
   - `while true: cat COLLAB/TURN.json; if current == my_id: act…`
4. When you need to pause the loop, set `current` to `human` and leave instructions in `task`.

Following this structure lets Codex and Claude Code collaborate asynchronously without manual “what’s next?” prompts. Each agent just obeys `TURN.json`, writes their findings in `notes.md`, and hands control back. Once you seed the initial turn file, the loop can continue indefinitely.
