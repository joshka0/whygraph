# ADR 0013: Rehearse the committed plan without a hosted agent

Topic: [[whygraph-eval-runner]]

## Context

The real batch 7 socket path was 115 bytes. Linux accepts at most 107
pathname bytes. Short self-test aliases did not expose the failure.
Store size and request count also caused failures only with real inputs.
ADR 0011 still governs confinement, service lifetime and attempt budgets.

## Options

- Copy the trial runner into a separate rehearsal runner.
- Substitute one executable in the closed attempt and use the existing
  preparation, services, launch configuration, event reader and attempt loop.

## Choice

Use executable substitution through an explicit rehearsal argument on
`closedAttempt`. The trial entry never supplies this argument. The registry
accepts only its existing agents. The stand-in is a committed program, not
a registry agent. No hosted executable starts during rehearsal.

`rehearse.mjs` builds the real registered plan. Each invocation owns a fresh
UUID result folder under `test-results/rehearsals`. It accepts an optional
`--results` root, outside `eval/results`, and refuses trial metadata there.
It records a rehearsal marker before any cell starts. Metadata marks every
attempt as a rehearsal. The scorer reads the folder only with `--results`.
The entry invokes the unchanged smoke checks after the plan, and propagates
every failure. Full rehearsals include the same smoke cells and check them.

The stand-in reads the task source, calls all four commands, and attempts
forbidden store, relate, code and network access through `/tools/shell`.
Every step checks its actual exit status. Controls use committed edit
fixtures that match their pass rules. Unknown controls refuse before launch.
Native-format events pass through the existing reader and scorer. A failed
step emits an error event and exits nonzero. No token or cost is invented.

Attempt work folders use UUIDs rather than cell names. Both socket names
are constant. Before any attempt starts, the runner checks the absolute work
root with a complete UUID and the longest socket leaf against 107 bytes.
Resolve the work root to its canonical absolute path before this length
check and before reservations. Derive mounts, sockets, native-read mappings,
isolation checks and retained work paths from that value. Resolve result
and ready template roots too; an alias must not become a second identity.
Confinement mounts keep their constant namespace paths. Long or unsafe
result and ledger components use a SHA-256 filename; archives add a UUID
to the bounded result key. Earlier batches keep their readable prefixes.
Cell identity stays in metadata and ledgers. All lengths count UTF-8 bytes.
Exec validation checks each argument, environment entry and total request
against the host limits. Oversized paths, prompts or requests refuse with
the limiting name before exec. For a closed shell request, that name stays
in host-only failure records; the agent receives ADR 0011's constant reply.
No limit is relaxed.

The closed transport owns the socket, mount and exec guards. It remains
importable without the trial registry. The registry owns filename encoding;
the runner and smoke checker use that one encoding for cells and ledgers.

| State | Lives in | Owner | Lifetime | Token | Outcome |
| --- | --- | --- | --- | --- | --- |
| Rehearsal results | Fresh result folder | One invocation | Retained evidence | UUID and marker | Complete or failed evidence |
| Attempt reservation | Existing ledger | Existing cell loop | Across restarts | Cell id | Existing ADR 0011 rules |
| Stand-in process | Existing agent confinement | Closed attempt | Attempt | Mounted executable and task config | Checked events or failed attempt |
| Prepared stores | Existing work root | Existing preparation lock | Batch | Existing receipt | Validated reuse or refusal |

## Consequences

Rehearsal runs before smoke. It proves the real inputs traverse the runner
without purchasing a model call. It does not measure agent judgment.
Results and work copies remain available for inspection. Repeated rehearsals
reuse prepared stores and create fresh attempts and results.
The brief forbids delegation and edits to self-tests. An independent author
owns executable checks for the failure contract from B7-94 onward. This
change claims no new formal proof; it changes I/O and launch glue only.
