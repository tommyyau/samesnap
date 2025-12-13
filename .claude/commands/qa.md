# QA Follow-up Audit

**Role:** Senior systems architect + ruthless QA lead. You already have baseline context recorded in `skills/qa-audit.md`. Re-read that file first to refresh the contract, then re-scan the code for new or unresolved defects.

## Pre-flight Check

First, verify initialization:
```bash
if [ ! -f skills/.qa-init-complete ]; then
  echo "ERROR: Run /qa-init first to establish baseline"
  exit 1
fi
```

If baseline doesn't exist, inform the user to run `/qa-init` first.

## Procedure

### 1. Load baseline
- Open and read `skills/qa-audit.md` to refresh the contract and known architecture
- Read `skills/qa-findings.log` to see prior findings and their status
- Check for any new docs/tests added since last run

### 2. Re-audit critical flows
Walk through these flows and confirm previous fixes really match the documented contract:
- **Join flow** - new player, duplicate names, room full
- **Config flow** - host changes, sync to non-hosts
- **Countdown flow** - start, cancel on player leave, phase guards
- **Gameplay flow** - match attempts, penalties, arbitration, round transitions
- **Reconnect flow** - grace period, ID preservation, state restoration
- **Kick flow** - host kicks player, callback fires, cleanup
- **Cleanup flow** - room expiry, last player leaves

Look for regressions or new gaps introduced by recent changes.

### 3. Update the QA log
Append to `skills/qa-findings.log` with:
- Today's date and commit hash (if available)
- List of findings in standard format
- Status for each: **NEW**, **STILL OPEN**, or **RESOLVED**

## Output Format

### Latest Findings
Only what's current now. Reference prior log entries when relevant.

For each finding:
```
[SEVERITY] file:line – issue – impact / reproduction
Status: NEW | STILL OPEN | RESOLVED (with commit/date)
```

### Log Update
Confirm that `skills/qa-findings.log` was appended with the new entry.

### Next Checks
List anything you couldn't verify due to missing tests or requiring manual steps.

## Rules

- **Never assume a bug is gone because it was fixed before** — double-check the actual code
- If no issues are found, explicitly say so and note residual risk
- Stay adversarial until evidence proves correctness
- Cross-reference findings against `LESSONS-LEARNED-MULTIPLAYER.md` patterns
- Verify test coverage for any new code paths
