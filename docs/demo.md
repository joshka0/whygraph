# Demo: shot list

A 1 to 2 minute screen recording on the fixture. It shows one thing: the same
edit request, given to the same agent twice, once without the why graph and
once with it. Without it, the agent makes the edit. With it, the agent finds
the decision behind the code and stops to ask.

The decision it finds is `note-2`, "Show thousands separators in totals". In
the demo it lives in a design-notes file outside the repo, as notes kept in a
wiki do; only a commit id connects it to the code. Nothing in `src/money.ts`
mentions it.

## Before recording

Set up whygraph as the README says (`WHYGRAPH` set, `whygraph`, `memod`,
`relate` on `PATH`), and have Claude Code installed and signed in. Then build
two copies of the shop, move the design notes out of both, and give one of
them the graph:

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

Use one terminal, a large font, and the same model in both takes. Start each
Claude Code session with `claude --allowedTools "Bash(whygraph:*)"` so that
`whygraph` runs without a permission prompt; approve the edit when asked.

The request, typed the same way both times:

> Simplify formatCents in src/money.ts by dropping the toLocaleString call.

## Shots

| # | Time | Typed | Must be on screen | Spoken |
| --- | --- | --- | --- | --- |
| 1 | 0:00-0:12 | `cd ~/demo/without && git log --oneline -3` | `Move design notes to the wiki`, `Add checkout with tax rounded half to even`, `Name every amount by its unit` | "A small shop repo. Its design notes moved to a wiki, so the code no longer carries them." |
| 2 | 0:12-0:40 | `claude --allowedTools "Bash(whygraph:*)"`, then the request | The agent reads `src/money.ts` and proposes or makes the edit that removes `.toLocaleString("en-US")` | "I ask an agent for a small cleanup. It reads the function, sees nothing against the change, and makes it." |
| 3 | 0:40-0:48 | exit Claude Code; `git diff --stat` | `src/money.ts | 2 +-` | "One line gone, and with it the thousands separators in every total." |
| 4 | 0:48-1:05 | `cd ~/demo/with && whygraph carry src/money.ts:formatCents` | `note-2  Show thousands separators in totals`, `changed by: 73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001); that commit changed 1 symbol`, `1  src/cart.ts:total` | "whygraph connects the code, its commits and the decision records, wherever they live. Before an edit, it answers: what must I carry in mind?" |
| 5 | 1:05-1:35 | `claude --allowedTools "Bash(whygraph:*)"`, then the same request | The agent runs `whygraph carry src/money.ts:formatCents`; its reply names `note-2` and `src/cart.ts:total` and asks before it removes the separators | "Same agent, same request. This repo tells the agent to ask the graph first. It finds the decision behind the separators, and asks me before reversing it." |
| 6 | 1:35-1:45 | exit Claude Code; `git status --short src` | no line for `src/money.ts` | "The code is untouched until a person decides. That is the why graph." |

## Notes for the take

- Agent replies vary from run to run. In trials on 2026-11-12 (Claude Code,
  Sonnet, one run each) the agent without the graph removed the call, and the
  agent with it ran `whygraph carry`, named `note-2` and made no change. If a
  take differs, record it again; do not edit the footage to match.
- Keep `decisions/notes.json` out of both repos, as above. With the notes in
  the repo, the agent without the graph found `note-2` by searching for
  "thousands", and the two takes looked the same.
- The skill alone was not enough in a trial: the agent had it and did not
  load it for this edit. The `CLAUDE.md` section from
  `skills/whygraph-rule.md` is what made it ask.
- Restart nothing between shots 4 and 5: Claude Code runs `whygraph` itself,
  and the store was built in the setup.
