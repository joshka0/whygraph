# ADR 0010: Read each batch's instructions from history

Date: 2026-11-15. Status: accepted. Topic: [[whygraph-trial-design]].

## Context

ADR 0008 keeps the trial design in one registry. Batch 6 also checks the
working skill against `c92205d`. That check prevents later skill changes.

## Options

- Keep the working skill frozen for all batches.
- Record an instruction commit for each batch.

## Choice

The registry records `instructionsCommit`, `storeAccess` and
`controlConditions`. The recorded design selects the runtime and control
conditions; a batch number does not override that design. Preparation reads both
`skills/whygraph/SKILL.md` and `skills/whygraph-rule.md` with `git show`.
A missing commit or file stops preparation before work files change.
Batches 1 through 6 record `c92205d`. Commit `c1ae17c` (2026-11-16 02:22)
cleaned the working skill and rule files, and `243e796` recorded `c1ae17c`
for batch 7 in `eval/registry.json`. Plans need no skill.

## Consequences

Earlier batches keep their instruction bytes when the working skill changes.
The independent author moves B6-26's skill check to the recorded commit.
That author retains the launcher byte check. This implementation changes
neither `skills/` nor the independent tests.
