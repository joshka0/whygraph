# Agents

This repo uses memod (bundled in [vendor/memod-0.2.0.tgz](vendor/memod-0.2.0.tgz);
the source repo is private; see [ADR 0014](docs/adr/0014-distribute-the-shop-graph.md)):
every exported value names the concept it owns with an `owns: [[topic]]` tag,
and lint reports two owners of one topic. Run `node_modules/.bin/memod topics`
before you name a topic, and reuse a topic only for an export that does the
same job.

- Decision logic lives in `src/*.pure.ts` (`boundary: pure`); child processes
  and files stay in the other files of `src/`.
- The Cypher that answers `why`, `impact` and `carry` lives in `recipes/`.
  `whygraph mcp` prints those files, and the commands run them: change a
  question there, not in TypeScript.
- Every `relate` call sets `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`
  (`src/tools.ts`).
- Check: `pnpm check` (tsrs) and `node_modules/.bin/memod lint`.
