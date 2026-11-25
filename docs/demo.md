# Demo: shot list, rehearsal and take log

A 1 minute 44 second motion-graphics and live-terminal recording on the shop
fixture (`1920x1080`, 30 fps, no voice track). It shows one thing: the same
edit request, given to the same coding agent twice at 1x real-time speed, once
without the why graph and once with it. Without it, the agent makes the edit.
With it, the agent finds the decision behind the code and stops to ask.

The decision it finds is `note-2`, "Show thousands separators in totals". In
the demo it lives in a design-notes file outside the repo (`../wiki/design-notes.json`),
as notes kept in a wiki do; only a commit id (`73ebd46`) connects it to the
code. Nothing in `src/money.ts` mentions it.

## Before recording

Set up whygraph on Linux as the README says (`WHYGRAPH` set, `whygraph`,
`memod`, and `Relate v1.2.0` on `PATH`), and have Claude Code installed and
signed in (`claude 2.1.330`, resolved `--model sonnet` = `claude-sonnet-5-5`).
Build two copies of the shop, move the design notes out of both, and give one
of them the graph with a relative external path so no local directory paths
appear in `whygraph carry` output:

```sh
cd "$WHYGRAPH"
scripts/fixture.sh ~/demo/without > /dev/null
scripts/fixture.sh ~/demo/with > /dev/null
mkdir -p ~/demo/wiki
cp ~/demo/with/decisions/notes.json ~/demo/wiki/design-notes.json
for r in ~/demo/without ~/demo/with; do
  git -C "$r" rm -q decisions/notes.json
  git -C "$r" -c user.name=demo -c user.email=demo@example.invalid commit -q -m "Move design notes to the wiki"
done
cd ~/demo/with
whygraph decisions adr docs/adr > ../adrs.json
whygraph build --decisions ../adrs.json --decisions ../wiki/design-notes.json
mkdir -p .claude/skills && cp -r "$WHYGRAPH/skills/whygraph" .claude/skills/
cat "$WHYGRAPH/skills/whygraph-rule.md" >> CLAUDE.md
```

Run both sides with an identical clean project-only Claude Code configuration
(no user hooks, no MCP servers, no session persistence, same model alias):

```sh
RELATE_TELEMETRY=0 DO_NOT_TRACK=1 DISABLE_AUTOUPDATER=1 \
  CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1 \
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 \
  claude -p "Simplify formatCents in src/money.ts by dropping the toLocaleString call." \
    --model sonnet \
    --permission-mode acceptEdits \
    --allowedTools "Bash(whygraph:*)" \
    --setting-sources project \
    --settings '{"disableAllHooks":true}' \
    --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
    --no-session-persistence
```

The request, identical on both sides:

> Simplify formatCents in src/money.ts by dropping the toLocaleString call.

## Shots (`1:43.7` total, no voice track)

All four terminal segments (`2b`, `3`, `4`, `5`) are unedited 1x-speed `vhs`
recordings composited inside motion-graphics framing rendered via headless
Chromium and `ffmpeg`.

| # | Time | Visual / typed command | Must be on screen | On-screen caption / takeaway |
| --- | --- | --- | --- | --- |
| 1 | 0:00-0:09 | Motion-graphics hook split (`src/money.ts` vs `../wiki/design-notes.json`) | `formatCents`, `toLocaleString("en-US")` struck through, `NO LINK IN CODE`, `note-2` | "whygraph tells a coding agent the decision behind a line of code before it edits the line." |
| 2a | 0:09-0:15 | Animated Relate graph schema | `Decision -[:CITES]-> Commit -[:CHANGES]-> Symbol`, `Symbol -[:DECIDED]-> DecidedTag -[:NAMES]-> Decision`, `USES`, `RESTS_ON`, `SUPERSEDES` | "One local Relate graph joins code, history, and decisions." |
| 2b | 0:15-0:31 | `relate --version` and offline query on `examples/shop.rl` (exact README command) | `Relate v1.2.0`, `Show thousands separators in totals,73ebd46,formatCents`, `a3bcb76` | "The sample store in the repo opens offline in Relate v1.2.0 and maps `note-2` to `formatCents` via commit `73ebd46`." |
| 3 | 0:31-0:47 | `cd ~/demo/without && git log --oneline -3`, `claude -p ... --model sonnet`, `git diff --stat` | `Move design notes to the wiki`, `Read src/money.ts`, `Edit src/money.ts`, `src/money.ts \| 2 +-` | "Without the graph, the agent sees no reason for `toLocaleString` and silently removes thousands separators." |
| 4 | 0:47-0:55 | `cd ~/demo/with && whygraph carry src/money.ts:formatCents \| head -n 22` | `note-2  Show thousands separators in totals`, `source: ../wiki/design-notes.json`, `changed by: 73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001); that commit changed 1 symbol` | "Before an edit, `whygraph carry` surfaces `note-2` from external notes via commit `73ebd46` plus callers one hop away." |
| 5 | 0:55-1:19 | `claude -p ... --model sonnet` (same prompt, clean config), `git status --short src` | Agent runs `whygraph carry`, cites `note-2`, commit `73ebd46`, and `src/cart.ts:total`, asks before reversing, `git status --short src` prints nothing | "With whygraph, the same agent queries the graph first, cites `note-2`, and leaves `src/money.ts` untouched." |
| 6 | 1:19-1:37 | Measured evidence & honest limits card | Rehearsal `10/10` with vs `10/10` without (`13.0s` vs `7.1s`), Zustand conflicts protected `97% (34/35)` vs stub `66% (23/35)` (`34.4M` vs `91.7M` tokens, `2.7x` fewer, `0/21` control false stops), strict exact-ID pass (`51%` vs `31%`, CI `[0.03, 0.39]`; Hono `+31 pp`, CI `[15, 48]`), `237` contract tests, explicit `HONEST LIMIT` callout explaining sibling-PR citations & ablations | Reports the rehearsal, protected-code rate, pre-registered exact-ID pilot scores, and honest limits together. |
| 7 | 1:37-1:44 | Outro card | `github.com/joshka0/whygraph`, `relate --database examples/shop.rl --read-only`, `Relate v1.2.0 · Local ONNX embeddings · Zero hosted API calls · MIT License` | Direct pointer to inspect the sample store offline. |

## Measured rehearsal (`2026-11-25`)

Before recording, we ran 10 headless trials per side on Linux (`x86_64`) against
public `joshka0/whygraph` commit `f3336426ff5aad1692dc2e12ee439f459eaa0dea`,
`Relate v1.2.0` (`SHA256 03e05e7cf25eec498e328837a3b6636c7a4807410b989e4b72948f1ebc8a99a5`),
and Claude Code `2.1.330` (`--model sonnet` -> `claude-sonnet-5-5`) with the
clean project-only config above:

| Side | Runs | Edited `src/money.ts` | Stopped & cited `note-2` | Timeouts | Min | Median | Max | Total tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `without` (plain repo, wiki outside) | 10 | 10 / 10 | 0 / 10 | 0 | 6.35 s | 7.14 s | 8.37 s | 506,155 |
| `with` (graph + skill + `CLAUDE.md` rule) | 10 | 0 / 10 | 10 / 10 | 0 | 12.07 s | 13.04 s | 14.14 s | 633,379 |

This rehearsal demonstrates the mechanism on a fixture whose notes were moved
outside the repo on purpose. Because `with` adds both the graph and the stop
rule while `without` has neither, it does not isolate the graph from the rule;
for stub-controlled trials and ablations on real repos, see
[README.md](../README.md#measured-results-and-limits).

## Take log (`2026-11-25`)

Every recorded take during video production is listed below, including
discarded takes:

| Shot | Take | Outcome | Duration | Status | Reason |
| --- | --- | --- | --- | --- | --- |
| `2b` (`relate` offline query) | 1 | Printed `Relate v1.2.0` and both `note-2` rows (`73ebd46`, `a3bcb76`) | 15.72 s | Kept | Clean output, 0 OCR privacy hits. |
| `3` (`without` agent) | 1 | Agent read and edited `src/money.ts`; `git diff --stat` showed `src/money.ts \| 2 +-` | 15.56 s | Kept | Clean 1x-speed output, 0 OCR privacy hits. |
| `4` (`whygraph carry`) | 1 | Printed full 42-line `carry` output | 8.5 s | Discarded | At 20 px font in a 730 px frame, lines 23-42 scrolled `note-2` off the top of the terminal. |
| `4` (`whygraph carry`) | 2 | Ran `whygraph carry src/money.ts:formatCents \| head -n 22` | 8.64 s | Kept | Shows `note-2`, `../wiki/design-notes.json`, `73ebd46`, `ADR-0001`, and `note-1` in one unclipped frame; 0 OCR privacy hits. |
| `5` (`with` agent) | 1 | Agent ran `whygraph carry`, stopped, cited `note-2` and `src/cart.ts:total`; `git status --short src` empty | 22.16 s | Discarded | 1 fps `tesseract` OCR privacy scan flagged an absolute local mount path in the streamed `Read` tool-call line (`/mnt/ssd/.../demo/wiki/design-notes.json`). |
| `5` (`with` agent) | 2 | Agent (`claude-sonnet-5-5`, `14.46 s`, `75,007` tokens) ran `whygraph carry`, stopped, cited `note-2`, `../wiki/design-notes.json`, `73ebd46`, and `src/cart.ts:total`; `git status --short src` empty | 23.80 s | Kept | Display formatter mapped `../wiki/` cleanly; 0 OCR privacy hits across all 104 frames. |

## Notes for re-recording

- Keep `decisions/notes.json` out of both repos, as above. With the notes in
  the repo, the agent without the graph can find `note-2` by searching for
  "thousands", and the two takes look the same.
- The skill alone was not enough in an earlier trial: the agent had it and did
  not load it for this edit. The `CLAUDE.md` section from
  `skills/whygraph-rule.md` is what makes it ask.
- Never edit or splice an agent's live terminal take to alter its verdict; if a
  take differs or leaks a local path, record a fresh take and log both takes
  above.
- Run a 1 fps OCR scan on the final MP4 before publishing to verify no local
  host paths, usernames, or private repo names appear on screen.
