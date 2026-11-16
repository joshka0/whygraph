# Trial 7 fix 7 author report

Branch: `batch-7-agent-network`, from `main` at `ec76408`.
Commits before this report: `4ac3593` (failure contract), `1750407`
(implementation and records). Nothing was pushed. No worktree was created.

## Changes and design

- Part 1: `resolverMounts` follows the host's standard resolver file links
  at launch. It recreates necessary external symlinks and mounts only final
  regular files read-only. A plain file in `/etc` adds no bind. The rule is
  independent of the condition. It rejects private work, checkout, identity,
  dynamic namespace and executable targets. On this host the only additional
  system-file bind is `/run/systemd/resolve/stub-resolv.conf` at the same
  namespace path. No resolver directory is bound. The bind exposes that
  file's bytes, with empty ancestor directories, and no host siblings.
  Store proofs, forbidden-read probes and file-identity checks are unchanged.
- Part 2: `closedAgentCause` reads the native error name and message field,
  keeps the first message line, redacts the prompt before truncation, and
  appends the exit and signal. It does not copy stderr, tool output or
  nested response/file payloads. Each attempt and its ledger retain that
  cause. The retry-stop marker and final exception retain both causes.
  Missing error events get an explicit completion/exit cause.
- Part 3: `startClosedAgent` and `runClosedAgent` are shared by cells and
  preflight. The runner awaits one real preflight before it reserves any
  pending closed-store cell. The preflight uses an empty repo, live private
  service and shell sockets, the same executable, model, launch arguments,
  mounts and environment, and a fixed no-tool prompt. Success requires exit
  0, a successful stop, finite positive tokens, exactly `ok` after trimming,
  and no tool events. Failure throws before cell writes. Records use
  `_preflight/<UUID>/record.json`, never cell `meta.json`. The existing
  scorer ignores them. Smoke-check prints preflight usage on its own line.
  `--plan` and a run with no pending cell start no preflight.
  `node eval/preflight.mjs --batch 7` runs only this preflight and exits.
- Rehearsal explicitly skips preflight. Its stand-in has no model connection
  and emits zero tokens. `rehearsal.json` records the exclusion; smoke-check
  reports it. This preserves the stand-in's purpose without inventing a
  successful model check. All rehearsal cells still use the shared builder.
- Part 4: no work-folder cleanup change. ADR 0011 says work copies and answer
  logs remain for smoke audits. ADR 0013 says results and work copies remain
  for inspection. The generic older runner's deletion rule does not govern
  closed attempts. All 71 pre-existing UUID folders remain. Their exact
  paths are listed below, followed by this run's 17 retained work folders.

## Governing decisions and evidence

- ADR 0008 fixes the registry and preserves earlier setup, task and score
  bytes. The registry and pass rules are unchanged.
- ADR 0010 freezes the shared opencode launcher and loads historical
  instructions. `eval/opencode.mjs`, instruction bytes and task inputs are
  unchanged. New launch glue stays in the closed runner.
- ADR 0011 owns the closed filesystem, condition-free client, private
  services, shell lifecycle, store proofs, file identities, two-attempt
  budget and retained work copies. Its new dated section records resolver
  file mounts, preflight and bounded failure causes. The existing retry
  decision module and preparation receipt checks are unchanged.
- ADR 0013 owns real-plan rehearsal with executable substitution and retained
  evidence. It now records the explicit preflight exclusion.
- B7-07 through B7-19 and B7-60 through B7-63 govern confinement and smoke
  evidence. B7-48 through B7-55 govern the unchanged attempt budget.
  B7-117 preserves constant agent-facing store errors and host-only causes.
  B7-118 preserves supplied path aliases and canonical identity comparisons.
  New independent failure cases are B7-119 through B7-133.
- Symbol history for `closedConfinement` names `c13ddf0`, `b3540e2` and
  `7fb1665`. Recent local history includes `115caf5`, `0549fa4`, `b18a30b`,
  `eec4a7f` and `ae04f53`. These explain frozen launcher bytes, host-owned
  shell startup, constant store-service errors and path alias handling.
  No `decided:` tag was found on the changed eval functions.
- The brief's measured failure and the supplied probe script were read. The
  archived probe was not run. The brief and failure list supplied the issue
  contract; no external issue query was needed. Error tracking is irrelevant
  to this local runner failure. No reachable fleet-memory tool was available.
  `mem view` exited 1. AUX exited 1 because `gondr` is not installed; no
  credential values were read to diagnose it. The allowed real agent used
  its existing identity mount through its normal startup.

## Startup evidence

The preflight's `startup.json` compares 251 host and confined file hashes:
five resolver inputs, `/etc/localtime`, and 245 system certificate files or
certificate links. Every hash matches; no read is missing. The identity
folder exists inside the namespace. Its files were not opened by the audit.
The real model response also proves that this configured agent can resolve
and reach its model from the confinement. No further missing startup
dependency was observed for opencode 1.18.29 and the configured model.

A metadata-only walk of `/etc` found these other external link classes:
`/etc/mtab` uses namespace `/proc`; disabled systemd unit links use
`/dev/null`; printer links use `/run/cups`; SGML uses `/var/lib/sgml-base`;
browser and desktop links use `/opt`. None is needed for this agent's
model startup. No additional bind was added for them. Existing `/proc` and
`/dev` mounts continue to supply their namespace-specific targets. This is
startup evidence for the configured agent, not a test of every host NSS
service or desktop program.

## Checks and exit codes

Every Node or package-manager build, check, rehearsal and hosted preflight
ran one at a time with:

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=200% <command>
```

All such commands and Git writes ran with sandbox escalation. No command
ran concurrently with another command.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm check` | 0 | tsrs passed |
| `node_modules/.bin/memod lint` | 0 | No ownership findings |
| `node scripts/readme-check.mjs` | 0 | 14 commands, 0 drifted |
| `node eval/score.mjs` piped to `diff - eval/score.txt` with pipefail | 0 | No output; existing score bytes unchanged after preflight |
| `node eval/run.mjs --batch 7 --stage smoke --plan` | 0 | 16 planned; 0 done; 16 to start |
| `node eval/run.mjs --batch 7 --plan` | 0 | 258 planned; 0 done; 258 to start |
| `node eval/run.mjs --only ripgrep5-conflict-rg-10 --plan` | 0 before and after | Same stdout/stderr; 20 planned, 9 done, 11 to start |
| `node eval/run.mjs --only hono6-conflict-hn-05 --plan` | 0 before and after | Same stdout/stderr; 15 planned, 9 done, 6 to start |
| `node eval/rehearse.mjs --batch 7 --stage smoke` | 0 | One invocation; 16/16 cells; every smoke check PASS |
| `node eval/preflight.mjs --batch 7` | 0 | One real preflight; record below |
| Frozen-directory `git diff ec76408 --stat` from the brief, also including `eval/opencode.mjs` | 0 | No output |
| `git diff --check` | 0 | No whitespace errors |

The rehearsal kept these executable receipts:

- `test-results/rehearsals/1b31bade-9f21-4b7a-9550-00119f4df48c/rehearsal.json`
- `test-results/rehearsals/1b31bade-9f21-4b7a-9550-00119f4df48c/smoke-check.txt`
- `test-results/rehearsals/1b31bade-9f21-4b7a-9550-00119f4df48c/measurement.json`

The smoke check recorded 80 denied confinement probes and 48 denied logged
agent attempts. Condition answers, identical agent files, service replies,
scorer blocks and per-run usage/time all passed. No trial cell was started.

## Real preflight record

- Record: `/home/dev/repos/personal/whygraph/eval/results/_preflight/3f032114-aa48-44be-b67c-ec0ec4c75b0d/record.json`.
- Model: `opencode-go/deepseek-v4.1-flash`; opencode 1.18.29. The launch sets
  no effort override.
- Exit: 0. Signal: none. Timeout: false. Status: passed.
- Tokens: 5,497 total. Input: 3,702; output: 3; cache read: 1,792;
  reasoning and cache creation: 0.
- Wall time: 11,470 ms, including setup and cleanup. This is one observed
  preflight duration, not a speed comparison.
- Events: `step_start`, text `ok`, `step_finish` with stop. No tool event.
- Sibling records: `command.json`, `output.jsonl`, `stderr.txt`,
  `startup.json` and shell lifecycle log when present.

## Limits and parked decisions

No decision is parked. No install, push, delegation, worktree, trial cell,
self-test command or full suite was run. No file under `eval/selftest/`,
`test/`, `skills/`, `src/`, `recipes/` or `bin/` changed. No existing folder
was deleted. The readme check performs its existing temporary-fixture
cleanup as part of the explicitly required command.

The independent author must implement B7-119 through B7-133 and the parent
must run the full gates. Those checks were deliberately not authored or run
by this code author. Alternate-host resolver layouts, injected failed
preflights and retry error cases remain for that independent gate. No new
formal proof is claimed for filesystem, launch or diagnostic I/O glue.
The existing pure retry rules and their proof/test contract are untouched.

The first failure-contract commit disabled hooks to avoid an unknown full
suite. The hook was then inspected: it runs only memod pre-commit. The
implementation commit used that normal hook and passed. Focused memod lint
also passed. No hook file or Git configuration was changed.

## Retained folders

No extra scratch folder remains outside the retained work and evidence roots.
The parent owns any removal after audit.

### Pre-existing UUID work folders

Count at author start: 71. All remain.

```text
/var/tmp/whygraph-eval/073e4e28-6b8d-486d-b7c5-3d9384a1db06
/var/tmp/whygraph-eval/0914cf0c-a2dc-4027-b629-d38a830d4179
/var/tmp/whygraph-eval/09205636-36af-4cb5-8911-f66ed00b6ca3
/var/tmp/whygraph-eval/09a0d531-71c0-4523-9c8d-c67d00ec7400
/var/tmp/whygraph-eval/09fa998a-7a53-4e10-9959-9d1ccf540134
/var/tmp/whygraph-eval/0cb16b9b-3f66-4c1e-b36f-5b9910ddfc61
/var/tmp/whygraph-eval/0cd1f072-f5b0-4d06-91b2-e1bf96d6c3d8
/var/tmp/whygraph-eval/0d740341-63f9-434c-99c3-a7952d0b553f
/var/tmp/whygraph-eval/0da09bfe-89a1-427b-a534-c7d83bdf151b
/var/tmp/whygraph-eval/0e13af93-64e8-4994-950d-d84fee30b56e
/var/tmp/whygraph-eval/13ce5108-6ca1-4a72-bf7b-f19588bc6611
/var/tmp/whygraph-eval/150b5a34-1bf7-49d8-b337-467ad89496d8
/var/tmp/whygraph-eval/15216bb3-459e-4dba-a986-9d0eb7014623
/var/tmp/whygraph-eval/1ba1e8b9-a997-4e4f-8c73-a30660570919
/var/tmp/whygraph-eval/26f48226-e40c-4e39-acde-0c21707a9510
/var/tmp/whygraph-eval/2c834fc3-2d72-4b95-b6ca-bc3c88d4ec84
/var/tmp/whygraph-eval/2fe67d8e-6607-47c8-a2fe-7f9070bf0c7a
/var/tmp/whygraph-eval/33c10aac-9d6e-4a36-99a7-c577ad14a240
/var/tmp/whygraph-eval/37f51f25-aeb5-4ac6-a8c2-6e2dd783e19a
/var/tmp/whygraph-eval/38f46834-e7b2-4d9b-8317-b8e76940bf52
/var/tmp/whygraph-eval/39b915b1-c41a-4ce2-aa14-8eeca1f5d1fb
/var/tmp/whygraph-eval/4183f27c-0fe1-4447-be41-18543331ee6b
/var/tmp/whygraph-eval/44a646db-3848-4b48-ac18-9bd2e5f1524f
/var/tmp/whygraph-eval/44eb4140-e4cd-44cc-a31e-0b798d5cf2c9
/var/tmp/whygraph-eval/45806518-e9fa-4040-889a-195f67200ba3
/var/tmp/whygraph-eval/462347cc-6707-4729-9c18-48f243c50dcd
/var/tmp/whygraph-eval/46f87498-77a4-4632-8c42-7c802cb8741a
/var/tmp/whygraph-eval/4f86e165-7eb7-4c0f-850b-2b9d69748436
/var/tmp/whygraph-eval/511495a2-b3a0-4bfe-aa68-104148171fd1
/var/tmp/whygraph-eval/51310cc4-ed82-49fb-9074-cacf4d61b88d
/var/tmp/whygraph-eval/518df27b-14bf-494a-83b6-88ad29fd78d2
/var/tmp/whygraph-eval/523e0ad1-fab8-4855-8965-db732d8efb56
/var/tmp/whygraph-eval/53f1acd1-b036-4e5a-8312-c01cd5ba2fc7
/var/tmp/whygraph-eval/554933a3-f012-4602-bc89-c08e4df020a6
/var/tmp/whygraph-eval/570b4e06-336a-4a8a-90ed-5ca3d63a3138
/var/tmp/whygraph-eval/5abb7528-4c58-4492-b18a-4d961266dec7
/var/tmp/whygraph-eval/5e7a9cb3-8ab1-461b-9d5e-e280bf01dbdd
/var/tmp/whygraph-eval/605c97e2-e337-4866-81ad-426f75b936f0
/var/tmp/whygraph-eval/6258db3d-a9d2-49f8-ab5c-44770f513f20
/var/tmp/whygraph-eval/64bbbf2e-bc9c-4ac7-831a-509568bdde21
/var/tmp/whygraph-eval/68553edd-ffc1-4c38-9cc4-4da206dd59b5
/var/tmp/whygraph-eval/68736e4a-b64f-48ae-bd95-24015b31e31e
/var/tmp/whygraph-eval/699b8f6a-d645-48e1-b33d-508a879f7380
/var/tmp/whygraph-eval/6b2881d6-6ff5-448f-bff4-f408b770ba8c
/var/tmp/whygraph-eval/6e5ab6eb-8774-4e41-acd1-70a68f06a7e4
/var/tmp/whygraph-eval/72e9d69a-8fed-4263-ab73-d1cad9ae87a6
/var/tmp/whygraph-eval/7ebd3fda-630a-4a6a-9298-cdb81e2c717b
/var/tmp/whygraph-eval/82e89c87-91c7-4add-93ed-9040b77590d5
/var/tmp/whygraph-eval/8699cd5a-50d6-41b0-a431-b8e71027da48
/var/tmp/whygraph-eval/89610080-0e83-4c5d-bba2-e7519debe62b
/var/tmp/whygraph-eval/95229753-f87b-4ae0-a57b-a26c697ecc72
/var/tmp/whygraph-eval/96637e40-f4d8-40cc-a12a-2617cdfd328d
/var/tmp/whygraph-eval/98166781-3dbd-41f0-ac35-b0506e6b1469
/var/tmp/whygraph-eval/9e8f7379-65fe-41df-b8f2-d960a09d7135
/var/tmp/whygraph-eval/9f6f3cb3-7c15-4f84-8a83-588a42fb722b
/var/tmp/whygraph-eval/a32ba7ee-b2b3-45c1-9fb7-dd85580a4ce0
/var/tmp/whygraph-eval/a8a4d4a4-696d-472b-9124-aeb24a4c793d
/var/tmp/whygraph-eval/ad2ccf55-badc-420e-89b6-dab99b0a62e6
/var/tmp/whygraph-eval/bc3708bb-7717-48cb-bad7-6fd5e57dcb2a
/var/tmp/whygraph-eval/c2aa43e0-afea-4226-bc31-289f84e25638
/var/tmp/whygraph-eval/cb63f911-8eb2-4a0e-bdb4-03771cd17dc3
/var/tmp/whygraph-eval/d5e2d8cc-a8ce-4461-b2fd-42f258b63ed3
/var/tmp/whygraph-eval/d85f4b2f-9d55-45be-9d55-ed8706143daa
/var/tmp/whygraph-eval/d8cf2347-eed3-4c7a-8be5-a95cdc1b2da5
/var/tmp/whygraph-eval/e5479074-254c-48fd-9976-2cc12921603a
/var/tmp/whygraph-eval/ebd14949-acff-4c34-87e8-ca157bf0f829
/var/tmp/whygraph-eval/edfd1ad5-d5f2-4bc4-8de8-f8d08bcb36f3
/var/tmp/whygraph-eval/f146a1d9-032b-403f-88cc-520d1bf1424c
/var/tmp/whygraph-eval/f8deb881-37ee-411f-85ec-de02f4d4cb8c
/var/tmp/whygraph-eval/f948835f-01bb-4980-82ca-77246e2835b1
/var/tmp/whygraph-eval/fee9689e-7e18-41d1-b768-aa3484afdb23
```

### Work folders created by this author

Preflight:

```text
/var/tmp/whygraph-eval/a3740ae3-fa0d-4892-adcd-3a9b1985aabe
```

Rehearsal:

```text
/var/tmp/whygraph-eval/0aef8adb-43e9-49e1-935c-e62fe13eaa94
/var/tmp/whygraph-eval/1619c022-248c-4eb1-ac4b-5e3c0e047053
/var/tmp/whygraph-eval/356a1e3e-2237-47a2-8a87-965c4a84e8b0
/var/tmp/whygraph-eval/3967080a-2863-4001-86d4-d1e5c237ad03
/var/tmp/whygraph-eval/5c2d7ab4-6788-4563-b5a5-fad295931c06
/var/tmp/whygraph-eval/8e41d7cc-6b2d-461f-af4a-0afbd669dc7e
/var/tmp/whygraph-eval/b4cb6557-44e1-49ad-b302-e795985da05c
/var/tmp/whygraph-eval/b7a43355-0682-4245-9cc7-a8931ced5992
/var/tmp/whygraph-eval/b909b34b-5afe-41bb-806b-bb422f038a24
/var/tmp/whygraph-eval/c133054b-a948-4f20-bddc-8dea8d496aea
/var/tmp/whygraph-eval/ddd336b2-d041-4d5d-aad1-e72e26f708de
/var/tmp/whygraph-eval/e6174e19-8967-4255-aa04-0c9896340b44
/var/tmp/whygraph-eval/e61db64a-6caf-4903-bf97-d6130d727436
/var/tmp/whygraph-eval/e814da9c-e788-4df8-be96-d70b1546ebd9
/var/tmp/whygraph-eval/faf9d10b-387d-49e9-beda-989541fc72d0
/var/tmp/whygraph-eval/ffe61e84-55ec-4088-a9f9-defe4950c017
```

### Evidence folders created by this author

```text
/home/dev/repos/personal/whygraph/eval/results/_preflight/3f032114-aa48-44be-b67c-ec0ec4c75b0d
/home/dev/repos/personal/whygraph/test-results/rehearsals/1b31bade-9f21-4b7a-9550-00119f4df48c
```

DONE
