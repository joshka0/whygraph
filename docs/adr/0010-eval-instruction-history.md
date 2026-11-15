# ADR 0010: Read each batch's instructions from history

Topic: [[whygraph-trial-design]]

## Context

ADR 0008 keeps the trial design in one registry. Batch 6 also checks the
working skill against `c92205d`. That check prevents later skill changes.

## Options

- Keep the working skill frozen for all batches.
- Record an instruction commit for each batch.

## Choice

The registry records `instructionsCommit`. Preparation reads both
`skills/whygraph/SKILL.md` and `skills/whygraph-rule.md` with `git show`.
A missing commit or file stops preparation before work files change.
Batches 1 through 6 record `c92205d`. Batch 7 has no recorded commit until
the parent cleans the skill and records that commit. Plans need no skill.

## Consequences

Earlier batches keep their instruction bytes when the working skill changes.
The independent author moves B6-26's skill check to the recorded commit.
That author retains the launcher byte check. This implementation changes
neither `skills/` nor the independent tests.
