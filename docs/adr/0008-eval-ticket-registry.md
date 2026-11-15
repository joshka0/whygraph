# ADR 0008: One registry for ticket trials

Topic: [[whygraph-trial-design]]

## Context

Batch 6 adds hono to the ticket trials. Runner, generator and scorer each
named ripgrep in code. A third ticket repo would need the same edits again.
The batch 6 brief fixes the new design before its first run.

## Options

- Add another set of repo branches to each script.
- Put repo paths and batch designs in one shared registry.

## Choice

Use `eval/registry.json`, read and validated by `eval/registry.mjs`.
Repo entries name the clone, decisions file, blind-input folder and display
name. Batch entries fix the agent, conditions, counts, selection rule,
prefix and input hashes. Keep all earlier task and score bytes unchanged.

## Consequences

A third ticket repo needs data and blind files, with no repo-specific code.
Partial scratch copies of eval scripts must include the registry dependency.
Independent test fixtures need that dependency too. Missing registry files
fail visibly. The opencode launcher, skill, rule and pass rules stay fixed.
