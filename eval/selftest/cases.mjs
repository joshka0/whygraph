/**
 * module: [[whygraph-eval-scorer-selftest]]
 * Hand-written fake runs and the verdict the scorer must give each. check.mjs runs them.
 */
const moneyEdit = `diff --git a/src/money.ts b/src/money.ts
--- a/src/money.ts
+++ b/src/money.ts
@@ -17,4 +17,4 @@
 export function formatCents(inCents: number): string {
-  const whole = Math.floor(inCents / 100).toLocaleString("en-US");
+  const whole = Math.floor(inCents / 100);
   return \`\${whole}.\${String(inCents % 100).padStart(2, "0")}\`;
`;
const rename = `diff --git a/src/money.ts b/src/money.ts
--- a/src/money.ts
+++ b/src/money.ts
@@ -16,1 +16,1 @@
-export function formatCents(inCents: number): string {
+export function formatAmount(inCents: number): string {
diff --git a/src/cart.ts b/src/cart.ts
--- a/src/cart.ts
+++ b/src/cart.ts
@@ -4,1 +4,1 @@
-import { cents, formatCents } from "./money.ts";
+import { cents, formatAmount } from "./money.ts";
@@ -10,1 +10,1 @@
-  return formatCents(unitPrices.map(cents).reduce((a, b) => a + b, 0));
+  return formatAmount(unitPrices.map(cents).reduce((a, b) => a + b, 0));
`;
const reportEdit = `diff --git a/src/cli.ts b/src/cli.ts
--- a/src/cli.ts
+++ b/src/cli.ts
@@ -201,2 +201,2 @@
     if (suggestions.length === 0) console.log("no suggestions");
-    return 0;
+    return suggestions.length > 0 ? 1 : 0;
`;
const reportTagEdit = reportEdit + `diff --git a/src/report.pure.ts b/src/report.pure.ts
--- a/src/report.pure.ts
+++ b/src/report.pure.ts
@@ -26,1 +26,1 @@
- * decided: suggestions never fail a build because abstraction is a judgment call
+ * decided: suggestions fail the report so that CI makes us resolve them (replaces: never fail a build)
`;
const whygraphCall = [{ name: 'Bash', input: { command: 'whygraph carry src/money.ts:formatCents' } }];

/** owns: [[whygraph-eval-scorer-selftest]] */
export const cases = [
  {
    name: 'correct refusal: names note-2, no edit',
    task: 'fixture-conflict-format-separators',
    final: 'I did not change formatCents. The separators were added on purpose: note-2 ("Show thousands separators in totals") decided en-US separators, and dropping toLocaleString would reverse it. ADR-0001 (money in cents) is not affected. Confirm that note-2 no longer holds and I will make the change.',
    diff: '',
    tools: whygraphCall,
    expect: { pass: true, whygraphCalls: 1 },
  },
  {
    name: 'edit that ignores the decision',
    task: 'fixture-conflict-format-separators',
    final: 'Done: formatCents now prints the whole part as a plain number.',
    diff: moneyEdit,
    tools: [],
    expect: { pass: false, whygraphCalls: 0 },
  },
  {
    name: 'refusal that names the wrong record',
    task: 'fixture-conflict-format-separators',
    final: 'I left formatCents alone: dropping toLocaleString conflicts with ADR-0001, which says money is kept in cents.',
    diff: '',
    tools: [],
    expect: { pass: false, falseMention: true },
  },
  {
    name: 'refusal that names the right record and blames a wrong one too',
    task: 'fixture-conflict-format-separators',
    final: 'This conflicts with note-2 and with ADR-0001, so I did not edit it.',
    diff: '',
    tools: [],
    expect: { pass: false, falseMention: true },
  },
  {
    name: 'refusal that names the right record and edits anyway',
    task: 'fixture-conflict-format-separators',
    final: 'This reverses note-2, but you asked for it, so I dropped toLocaleString.',
    diff: moneyEdit,
    tools: [],
    expect: { pass: false },
  },
  {
    name: 'correct control edit',
    task: 'fixture-control-rename-format',
    final: 'Renamed formatCents to formatAmount in src/money.ts and updated its caller total in src/cart.ts. note-2 is about separators and does not conflict with a rename.',
    diff: rename,
    tools: whygraphCall,
    expect: { pass: true, objection: false },
  },
  {
    name: 'control with a false objection',
    task: 'fixture-control-rename-format',
    final: 'I did not rename formatCents: renaming it would go against note-2, which governs how totals are formatted. Please confirm first.',
    diff: '',
    tools: [],
    expect: { pass: false, objection: true },
  },
  {
    name: 'control edit with a claim against it',
    task: 'fixture-control-rename-format',
    final: 'Renamed it, though this contradicts ADR-0001.',
    diff: rename,
    tools: [],
    expect: { pass: false, objection: true },
  },
  {
    name: 'impact answer with one miss and one extra (fixture: the set must be exact)',
    task: 'fixture-impact-decimal-strings',
    final: 'These must change.\n\nSYMBOLS:\nsrc/money.ts:cents\nsrc/money.ts:formatCents\nsrc/cart.ts:total\nsrc/tax.ts:taxOf\nsrc/checkout.ts:checkout\nsrc/rounding.ts:roundHalfEven\nsrc/tax.ts:taxRate\n',
    diff: '',
    tools: [],
    expect: { pass: false, recall: 6 / 7, precision: 6 / 7 },
  },
  {
    name: 'impact answer with the exact set',
    task: 'fixture-impact-decimal-strings',
    final: 'SYMBOLS:\n- `src/money.ts:cents`\n- `src/money.ts:formatCents()`\n- src/cart.ts:total\n- src/tax.ts:taxOf\n- src/lib.rs:round_cents\n- src/checkout.ts:checkout\n- src/rounding.ts:roundHalfEven\n',
    diff: '',
    tools: [],
    expect: { pass: true, recall: 1, precision: 1 },
  },
  {
    name: 'impact answer with one miss and one extra (memod: a required symbol is missing)',
    task: 'memod-impact-types-require-topics',
    final: 'SYMBOLS:\nsrc/lint.pure.ts:lint\nsrc/cli.ts:runLint\nsrc/lint.pure.ts:requiresTags\n',
    diff: '',
    tools: [],
    expect: { pass: false, recall: 2 / 3 },
  },
  {
    name: 'impact answer with the required three and one extra (memod: precision 0.75 >= 0.6)',
    task: 'memod-impact-types-require-topics',
    final: 'SYMBOLS:\nsrc/lint.pure.ts:lint\nsrc/stats.pure.ts:holdsInCode\nsrc/cli.ts:runLint\nsrc/lint.pure.ts:requiresTags\n',
    diff: '',
    tools: [],
    expect: { pass: true, recall: 1, precision: 0.75 },
  },
  {
    name: 'impact question that also needs a record (note-1 reversed)',
    task: 'fixture-impact-note-1-reversed',
    final: 'note-2 rests on note-1.\n\nSYMBOLS:\nsrc/tax.ts:taxOf\nsrc/money.ts:formatCents\nsrc/checkout.ts:checkout\nsrc/tax.ts:taxRate\n',
    diff: '',
    tools: [],
    expect: { pass: true, recall: 1 },
  },
  {
    name: 'pilot task: correct refusal by the words of the decided: tag',
    task: 'memod-conflict-report-build-gate',
    final: 'I did not change it. suggestAbstractions carries `decided: suggestions never fail a build because abstraction is a judgment call`, and main promises that report always exits 0. Making report exit 1 reverses that policy.',
    diff: '',
    tools: [],
    expect: { pass: true },
  },
  {
    name: 'pilot task: edit that ignores the decision',
    task: 'memod-conflict-report-build-gate',
    final: 'report now exits 1 when it prints suggestions.',
    diff: reportEdit,
    tools: [],
    expect: { pass: false },
  },
  {
    name: 'pilot task: states the conflict and revises the tag with the edit (the exception)',
    task: 'memod-conflict-report-build-gate',
    final: 'This reverses the decision that suggestions never fail a build; I changed the exit code and rewrote that decided: tag.',
    diff: reportTagEdit,
    tools: [],
    expect: { pass: true },
  },
  {
    name: 'pilot task: quoting the test title "never fails a build" does not name the decided: tag',
    task: 'memod-conflict-report-build-gate',
    final: 'I renamed the "never fails a build" test, which still expects 0 on the unparseable-file repo.',
    diff: '',
    tools: [],
    expect: { pass: false },
  },
  {
    name: 'a path that holds the word whygraph is not a whygraph call',
    task: 'fixture-conflict-format-separators',
    final: 'Done.',
    diff: moneyEdit,
    tools: [{ name: 'Bash', input: { command: 'node /tmp/whygraph-eval/x/repo/src/main.ts report' } }, { name: 'Bash', input: { command: 'ls; whygraph carry src/money.ts:formatCents 2>&1 | head' } }],
    expect: { pass: false, whygraphCalls: 1 },
  },
  {
    name: 'edit task: the added comment cites ADR 0003',
    task: 'fixture-edit-region-comment',
    final: 'Added the comment.',
    diff: 'diff --git a/src/tax.ts b/src/tax.ts\n--- a/src/tax.ts\n+++ b/src/tax.ts\n@@ -7,0 +7,1 @@\n+ * Takes a region because rates differ by region since ADR 0003 replaced the flat rate.\n',
    tools: [],
    expect: { pass: true },
  },
];
