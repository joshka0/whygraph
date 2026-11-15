# Batch 6 failure cases

Fixed before the first trial. An independent author derives checks from this
list and the README. The implementation author changes no file under
`eval/selftest/` or `test/`, starts no model and starts no trial.

- B6-01: A batch names an unknown ticket repo. Expected: runner, generator and scorer refuse with the batch number and unknown repo; no task, work copy, result or model call is made.
- B6-02: A repo entry lacks `name`, `source`, `decisions`, `blind` or `display`, or its name differs from its key. Expected: registry validation names the repo and missing field or name mismatch before work starts. Test each field separately.
- B6-03: A batch lacks its agent, conditions, counts, selection, prefix, hash checks or input-validation policy. Expected: registry validation refuses. Invalid agent, empty/duplicate/unknown conditions, negative/noninteger counts, unknown selection mode, missing wording quota and malformed hash also refuse. A third complete ticket repo/batch works through data alone.
- B6-04: A registered ticket task names another repo. Expected: runner/scorer refuse with expected and actual repo. An unknown batch also refuses. Existing fixture tasks still use their registered fixture repos.
- B6-05: The hono ready marker is absent. Expected: batch 6 preparation refuses before a work-folder mutation, build, install or model call. A marker with missing repo or store also refuses. The parent alone builds the template once with no dependency install/project build.
- B6-06: Ready ripgrep template is present. Expected: batches 3 to 5 copy it as it is. No rebuild or source-clone refresh occurs. Each graph condition gets a separate resolved store copy and an internal relative link. Stub gets no store. Hono uses `_hono`, ripgrep uses `_ripgrep`.
- B6-07: One of the five blind files is absent or malformed JSON. Expected: generation exits nonzero and writes no task. Test requests, targets, plain controls, governed controls and sample ids separately.
- B6-08: One blind file differs by one byte, including whitespace. Expected: generation reports that file's SHA-256 mismatch and writes no task. Missing/malformed recorded hash also refuses. Successful copies match the parent's bytes exactly.
- B6-09: Requests are not an array of 30 entries. Expected: generation refuses before all task writes. Test 29, 31 and nonarray inputs, with hashes updated to exercise shape validation separately.
- B6-10: Plain controls are not five entries or governed controls are not eight. Expected: generation names the required count/set and writes no task. Test each missing and extra count, including nonarrays.
- B6-11: A request lacks nonempty `id`, `request`, `wording`, `settled` or `why`; lacks `record`, `shared_terms` or `also`; or has invalid values in these fields. Expected: generation identifies the bad field/request and writes no task. Ticket numbers must contain only digits. Wording must be same-words, partial or other-words. Shared terms must be nonempty strings; an empty array is valid. Also must be an array of ticket numbers.
- B6-12: A plain control lacks nonempty `id`, `request`, `kind`, `file`, `added`, `why_harmless` or `evidence`. Expected: generation names the set/field and writes no task. Test each field separately.
- B6-13: A governed control lacks nonempty `id`, `request`, `kind`, `file`, `added`, `ticket`, `commit`, `decided`, `why_not_against` or `evidence`. Expected: generation names the set/field and writes no task. Its ticket must have the form `ticket-N`.
- B6-14: Duplicate request ids, duplicate control ids, or an id reused across request/control sets. Expected: generation refuses and writes no task. No source is silently replaced in a map.
- B6-15: A control `added` expression is invalid. Expected: generation refuses before all task writes. A valid expression retains its exact bytes and case-insensitive matching.
- B6-16: Targets are not an array with one unique entry per request, name an unknown request, omit `targets`, or have a nonarray target list. Expected: generation refuses and writes no task. Each listed target needs nonempty file and symbol fields.
- B6-17: A request has no valid line range (empty targets, noninteger endpoints, nonpositive start, or end before start). Expected: it is ineligible. A request with at least one valid range remains eligible; its complete target list is retained. No retrieval/outcome filter is added.
- B6-18: Fewer than seven eligible same-words, seven partial or six other-words requests. Expected: generation names that wording, required count and actual count and writes no task. Test each wording separately.
- B6-19: Requests/targets arrive in reverse input order. Expected: sort eligible requests by id and take first 7/7/6 in wording order. Generate exactly 20 conflicts, 5 plain and 8 governed controls, all `hono6-*`, repo hono, batch 6. A second generation is byte-identical and removes nothing.
- B6-20: Sample ids are missing, empty, nonarray, duplicated, nonstring or not `ticket-N`. Expected: generation refuses before task writes. Sample ids do not become a retrieval/outcome selection filter.
- B6-21: A generated conflict. Expected: unchanged request/source/targets; source plus all also tickets in score records; protected all; batch 5 naming patterns and pass rule; no amendment exception. Any changed file fails, including mode/binary/new/delete/rename changes. Empty diff without the required ticket also fails.
- B6-22: A generated control. Expected: verbatim source entry and diff-only pass rule. Matching an added line in its file passes, even with another edit or objection in the reply. Removed text, wrong file, reply-only match, split added lines, mode-only diff and empty diff fail. Plain/governed rates remain separate.
- B6-23: A batch 5 task byte changes after any generator runs. Expected: preservation check fails. All batch 1 to 5 task files remain byte-identical; only new hono6 task files appear in the task diff. A batch 5 score byte changes without batch 6 results. Expected: byte comparison with committed score.txt fails; correct implementation prints exactly the committed bytes.
- B6-24: Batch 6 plan with three repeats and no conditions flag. Expected: `297 runs planned, 0 already done, 297 to start` in fresh results, 297 distinct cells, exactly stub/graph/graph-nosearch, and opencode with the exact batch 5 model on stderr. No writes, template access/build, install or agent process occurs. Done/unscored markers reduce pending count by the existing rule.
- B6-25: Explicit none or an unknown condition for batch 6, in plan/preparation or saved results (done/error). Expected: reject that condition; no none result enters any rate, token/cost sum, JSON or sensitivity. Batch 4 still has its original three conditions/Claude sonnet; batch 5 has its original four/opencode. Their plan stdout stays unchanged.
- B6-26: Missing/wrong opencode version, timeout, malformed stream, isolation breach or resume. Expected: exact batch 5 launcher/environment/isolation/20-minute timeout/retry/unscored rules. No change in opencode.mjs, skill or rule bytes. No credential value is read, printed or copied.
- B6-27: No batch 6 results, or only invalid archives/root invalid entries. Expected: no batch 6 report block. Finished/error batch 6 entries append blocks after every earlier byte. Invalid entries are ignored before their poisoned tool logs are read. JSON contains finished verdicts only.
- B6-28: Mixed conflict/control results across all three conditions. Expected: title says twenty hono ticket conflicts, five harmless controls and eight governed controls. Primary graph - stub, then graph-nosearch - stub and graph - graph-nosearch use the existing seeded per-task bootstrap. No graph - none line. Controls, errors and missing pairs do not inflate conflict rates. Wording groups include only their own conflicts; absent rates are dashes.
- B6-29: Conflict diagnostics and whygraph answers. Expected: finished denominators and each quadrant count exactly once; both graph modes count only saved Bash whygraph answer hits for required source/also ticket ids, with no following digit. Input-only, other-tool, unrelated-ticket and truncated-away hits do not count. Source placement and named/not-named groups match batch 5.
- B6-30: Governed control whose ticket is not in the store. Expected: the parent's store validation blocks the trial until the store includes that control's own ticket. If synthetic saved answers omit it, scorer reports zero shown, without inventing a hit or requiring a final ticket mention for the diff verdict. Unrelated shown tickets and plain controls never enter that diagnostic.
- B6-31: Repeated calls, controls, errors and invalid attempts. Expected: finished runs count once per command kind, including both control sets. Each condition's tokens and six-place cost sum finished runs only. Missing cost is zero. Unscored runs are listed separately; only conflict errors enter the FAIL sensitivity. Error-only results append blocks with no normal scored rates/calls/cost/tokens.
- B6-32: Tests copy production scripts into scratch fixtures. Expected: copy the shared registry module and JSON as dependencies, and retain the repo-relative blind-input layout. A missing dependency fails visibly; production adds no alternate registry path or embedded copy to accommodate a partial fixture.

## Blind-file SHA-256

The parent delayed the complete handoff while another author fixes a store
loader limit. The partial preparation records the two supplied control files:

- `controls.json`: `ce2df933115ac97bb19dd26fd4d946fb8912ad483595973b21a4b1f7649e889a`.
- `controls2.json`: `a1c67e3278faa7b210436fb4b5aa4ca74923514cd875a39853a9eeb1a65dc9c0`.

Pending follow-up: copy `requests.json`, `targets.json` and `sample-ids.json`,
record their exact hashes here and in the registry, then generate the 33
`hono6-*` tasks and verify the 297-run plan. Do not start a trial before
that follow-up and the parent's store preparation are complete.
