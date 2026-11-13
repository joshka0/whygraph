
## whygraph

This repo has a why graph. Before you change a symbol, run
`whygraph carry <file>:<symbol>`; when a decision changes, run
`whygraph impact <id>`; when you wonder why code is the way it is, run
`whygraph why <file>:<symbol>`. Before a change, also run
`whygraph search "<the change in your own words>"`: a record that governs it
may have no link to the code, and `search` lists candidates to judge.
`carry` also shows the decisions and checks on the symbols it uses and on
those that use it; a decision there binds your edit too. Its last part lists
the records that share the most distinctive terms with the code: those are
candidates to judge, not links. For a symbol longer than 40 lines, ask
`carry <file>:<start>-<end>` with the lines you will touch; on the symbol form
that part is one line naming the range form instead. The whygraph skill says
how to read the answers.
