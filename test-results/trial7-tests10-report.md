# Independent refused-request and closed-access tests

Branch: `batch-7-refused-requests`. Base: `a72ba08`. Date: 2026-11-16.
Contract: `/home/dev/scratch/whygraph-eval/trial7-tests10-brief.md`.

The 74 new cases and five amended cases have focused results. The latest
observations are 77 passing cases and two red cases for one product fault.
These are combined focused observations, not a full-suite result. No product
code changed. All 34 items B7-134 through B7-167 have named cases.

## Code failure

B7-148 requires an unknown service-log event to fail the smoke check.
Both new owner cases remain red:

- `B7 B7-148 unknown event fails service accounting`.
- `B7 B7-148 unknown event must fail full smoke CLI with authentic reply fields`.

The reproduction adds `event: "unexpected"` to an authentic dispatched
reply. It keeps its answer, receipt, counts and metadata intact. The callback
prints `PASS service answered every call: 2 refused requests`. The full CLI
prints all eight PASS lines and exits 0. The contract requires FAIL and
nonzero exit. `eval/smoke-check.mjs` treats every event other than `refused`
as a dispatched reply and accepts its otherwise valid fields.

The full CLI output is retained at
`test-results/refusals-hcaEl1/11-refusals-0/unknown-event-cli.json`.
The receipts index also names that fixture path. The tests do not loosen this
contract and do not change the checker.

## Governing decisions

- Amended B7-13, B7-63 and B7-80, dated 2026-11-16, separate pre-dispatch
  refusal accounting from dispatched failures and require local client limits.
- Amended B7-62 and B7-150, dated 2026-11-16, use the five fixed probe
  verdicts and count literal mentions and raw refusals as observations.
- ADR 0011, **Refused requests** and **Evidence for closed access**, both
  dated 2026-11-16, records those rulings. Its attempt ownership and retry
  rules still govern the real service, shell launcher and settlement checks.
- ADR 0010 keeps recorded instruction bytes and earlier batches frozen.
  ADR 0013 permits a scripted executable through the real closed runtime.
- The existing test exports own their existing memod topics. The new export
  owns `whygraph-batch7-refusal-selftest`. `memod topics` ran before naming it.

## Coverage per item

Each name below is in `eval/selftest/batch7-refusals.mjs`, except the amended
B7-80 and B7-62 cases described in the next section. Exact expanded case
names and their latest results are in `trial7-tests10-receipts.json`.

| Item | Executed coverage |
| --- | --- |
| B7-134 | Raw HTTP closes empty; exact refusal event, separate counters, identical real-client answers before and after. |
| B7-135 | Counts 65 and UINT32_MAX each produce one count refusal. |
| B7-136 | Length 60,001 refuses before payload, with whole and split length headers. |
| B7-137 | A 66,012-byte frame refuses in one write and split chunks. |
| B7-138 | Empty, partial count, partial length and partial payload change no counters; the next client works. |
| B7-139 | 65 client arguments give exact usage, exit 2, empty stdout and zero connections, with a live or absent service. |
| B7-140 | ASCII 60,001 bytes and UTF-8 60,002 bytes give the same local rejection, live and absent. |
| B7-141 | Two 33,000-byte fields exceed the frame limit and reject before connection, live and absent. |
| B7-142 | Inclusive count, argument and total-byte limits dispatch once and preserve direct product bytes/status; the exact total includes UTF-8 text. |
| B7-143 | Scripted attempt is done with matching metadata. Real settlement makes one reservation and no retry/archive. Timeout and symlink breach keep their classifications. |
| B7-144 | A dispatched answer fault after a raw refusal returns exact exit-70 client bytes and separate failure metadata. A timeout flag still yields a harness failure. |
| B7-145 | Real unavailable client bytes and public runOne harness classification survive earlier refusals, including a real worker timeout. |
| B7-146 | A real shell command cannot connect to the launcher socket; the outer scripted process has the socket and uses it. |
| B7-147 | Zero and nonzero refusals pass callback accounting; a complete 16-cell smoke fixture passes the actual CLI with one refusal. |
| B7-148 | Missing/malformed replies, missing/mismatched refusal evidence, unknown reasons, failures, unavailable replies and client output fail. Unknown events remain red in callback and CLI tests. |
| B7-149 | Refusals before, between and after replies preserve ordered health checks; a changed dispatched reference fails. |
| B7-150 | With no tool mentions, two raw refusals print five denied probes, two observed attempts and two raw refusals. |
| B7-151 | Queued chunks refuse once, never dispatch later, and leave earlier reason snapshots unchanged; the next real client works. |
| B7-152 | Batch 5/6 plans match 6fc48a3 and d1f41cf byte for byte; launcher, registry, scorer, frozen inputs and old reports/checks have no diff. |
| B7-153 | The joined ls/file command counts once and passes regardless of discovery output. |
| B7-154 | The tool-discovery/strings command counts once and passes without a denial diagnostic. |
| B7-155 | The joined env/ls/file/head command counts once and passes with only the listing. |
| B7-156 | The empty strings pipeline counts once and passes. |
| B7-157 | Full/selected stores, client, source and relate mentions count once per arbitrary tool record; ordinary repo reads add nothing. |
| B7-158 | Empty text, listings, success claims, JSON and denial words keep the same access verdict. |
| B7-159 | Actual full and selected manifests exposed separately return bytes/status 0 and fail the access check. The real layout has no CURRENT file. |
| B7-160 | A compiled readable client exposed at /tools/whygraph returns executable content and fails the access check. |
| B7-161 | Exposing only service source makes the source probe succeed and the access check fail. |
| B7-162 | Exposing only product source makes the second source read succeed and the access check fail. |
| B7-163 | Real relate --version succeeds without a store and fails access. The disabled alias exits 126; an absent program exits 127; both deny. |
| B7-164 | Missing, duplicate and arbitrary names, absent/null/fractional status and zero with denial words all fail. |
| B7-165 | Changed answer, direct reference, store identity and fingerprint evidence fail B7-60 with access probes unchanged. |
| B7-166 | Frozen-file diff and exact earlier plan comparisons also use d1f41cf. Shared isolation code is unchanged. |
| B7-167 | All five callbacks run on each of the four graph-family archived attempts. The four local checks pass. Identical-files retains its four-task failure. Peer/instruction assertions pass with four synthetic task identities and unchanged archived peer evidence. |

## Amended existing cases

Three existing source locations held stale contracts. The B7-80 table
expands into three cases, so these edits change five cases:

- `batch7-host.mjs`: count, field and total client overflows now require
  exact usage/exit 2 and an unchanged service snapshot.
- `batch7-smoke.mjs`: fabricated successful tool text now passes all eight
  checks and counts one observed input mention.
- `batch7-smoke.mjs`: discovery now uses the current PASS wording. Its
  `command -v relate` input is one literal mention under amended B7-62.
  The native repo read and `command -v whygraph` add no mention.

The search found no other executable expectation that requires a frame
refusal to be a service failure or agent-shaped output to prove a read.
Existing B7-13 cases assert only rejected bytes and do not classify frame
refusals. Existing successful/missing/not-run probe cases remain valid.
Historical prose in the audit is retained and labeled as history.

## Planted faults

Every plant runs its owner against clean behavior before checking the
mutated behavior. Each JSON receipt holds the red assertion. Mutations
change scratch copies or the isolated smoke callback text. No production
file is edited. There are 13 distinct caught plants, with one repeat receipt.

| Fault | Owner and red evidence |
| --- | --- |
| Refusal counted as failure | B7-134, `plant-refusal-is-failure.json`. |
| Refusal also dispatches search | B7-134, `plant-refusal-dispatches.json`. |
| Dispatched failure counted as refusal | B7-144, `plant-failure-is-refusal.json`. |
| Client sends 65 arguments | B7-139, `plant-client-sends-over-limit.json`. |
| Metadata drops refusals | B7-143, `plant-metadata-drops-refusals.json`. |
| Checker accepts status 0 | B7-164, `plant-accept-probe-zero.json`. |
| Checker accepts missing probe | B7-164, `plant-accept-probe-missing.json`. |
| Checker accepts duplicate probe | B7-164, `plant-accept-probe-duplicate.json`. |
| Old heuristic fails four denied commands | B7-153 through B7-156, four `plant-old-heuristic-*.json` receipts. |
| Old CURRENT target misses manifest leak | B7-159, `plant-missing-CURRENT.json`. |

The receipts index holds each full plant path and its assertion. The two
runs containing the dispatched-search plant caught the owner assertion but
later exited on an unhandled AbortError during plant cleanup. The final
fixture waits for that planted query before stopping the service. That
cleanup edit is syntax-checked; the plant was not run a third time. No
clean exit for that final cleanup edit is claimed.

## Scripted end-to-end attempt

`batch7-refusal-agent.mjs` emits native events and runs actual shell commands.
It uses the real client, socket, shell launcher, health probes and metadata
writer. It makes no model call and records zero tokens. Its command shapes
include curl on the Unix socket, raw HTTP through Python, strings, joined
ls/file/head, an outside-host curl and a filesystem search for the store.
All required tools were available; no substitute command was needed.

The completed attempt has nine dispatched replies and two raw refusals.
Every real client call has its exact service answer, except the deliberately
local 65-argument call, which has exact usage and no connection. The saved
observations and native events retain actual stdout, stderr and statuses.
Its condition, access, service-accounting and usage/time callbacks pass.
The separate settlement check proves no retry or invalid archive.

## Verification and limitations

All case commands ran one at a time with the required PATH additions and:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=200%
```

The first raw-frame case passed before larger focused selections ran.
The initial scripted fixture failed because its synthetic identity directory
was missing. Creating its empty `identity/opencode` directory fixed setup.
A nonunique mutation anchor and an archive selection that included an
unrelated fifth record were also corrected in the tests. Their corrected
focused cases passed. The discovery assertion initially expected zero
mentions; its corrected contract count of one passed.

The first broad selection was limited to these new cases and plants.
It aborted before its final receipt write. Its observed stdout outcomes
are labeled as such in the receipts index. Later selections saved incremental
receipts. No single clean aggregate run is claimed. The two unknown-event
cases remain red because the product violates B7-148.

The timeout-flag classification cases inject an already observed timeout
at the run-result boundary. They do not claim to exercise the 20-minute
clock. The unavailable-service worker case uses the existing timer path,
including SIGTERM and SIGKILL. The lost-service public runOne case remains
invalid and returns the correct client diagnostic. Its final reason is
`Server is not running.` from a second service stop; that cleanup exception
replaces the more useful unavailable-service cause. This separate observation
is recorded for the parent; no cleanup fix or broader contract is added.

All five changed JavaScript files passed `node --check`. `pnpm check`
passed with tsrs. `node_modules/.bin/memod lint` passed. The final audit
JSON and `git diff --check` also pass. All 79 case names have an observed
focused outcome. Full self-test, stress, full suite, real preflight, trial
cells, new full rehearsal, model calls, installs, delegation and pushes did
not run. The archive remained read-only. The existing full smoke fixture
uses simulated agent completion and actual service evidence; it is not a
trial or a new 16-cell rehearsal.

Fleet memory is unavailable. AUX reports that gondr is not installed and
cannot fetch skills freshness. No credential is needed for these checks.

## Retained evidence

Keep `test-results/trial7-tests10-inventory.mjs` and
`test-results/trial7-tests10-receipts.json`. The receipts index lists all
eight `test-results/refusals-*` roots, all 37 work roots/aliases, case
outcomes, plant assertions and fixture artifacts. All scratch stays under
`test-results/`. Nothing was deleted.

## Exact focused commands

Each command below used the PATH and resource prefix above. The final
column is the observed command result, before later fixture corrections.

| Filter for `node eval/selftest/batch7-refusals.mjs` | Scratch suffix | Exit and result |
| --- | --- | --- |
| `B7-134 raw HTTP` | `JMJ7JB` | 0; 1/1 |
| `B7-143 B7-146 scripted` | `cGHCc4` | 1; 0/1; missing fixture identity |
| `B7-143 B7-146 scripted` | `gfLJDd` | 0; 1/1 |
| `^(?!.*B7-143 B7-146 scripted)` | `ZszuZy` | 1; interrupted by planted-query cleanup; no final total |
| `B7-144 dispatched\|B7-145 earlier\|B7-167\|plant (refusal-dispatches\|dispatched failure\|client\|metadata\|smoke\|old\|CURRENT)\|full smoke CLI` | `dEty6X` | 1; four cases passed before planted-query cleanup aborted |
| `plant (dispatched failure\|client\|metadata\|smoke\|old\|CURRENT)\|full smoke CLI` | `lEHjYF` | 0; 9/9 |
| `settles once\|timeout flag\|absent relate\|unknown event must fail full\|rejects locally\|fabricated tool success\|ordinary command discovery` | `hcaEl1` | 1; 7/9; product unknown-event fault and stale discovery count |
| `ordinary command discovery` | `yWcVQp` | 0; 1/1; corrected literal count |
