#!/usr/bin/env bash
# Builds the whygraph fixture repo, commit by commit, at the folder given (it must not exist).
#
#   scripts/fixture.sh <folder>
#
# Fixed author, committer and dates make the commit ids the same on every run.
# History (oldest first):
#   c1 main     money.ts, cart.ts, ADR 0001 (money in cents); the tag on cents names adr-0001
#   c2 main     tax.ts, ADR 0002 (flat tax; cites ADR 0001); the header tag of tax.ts names ADR-0002
#   c3 regional tax.ts regional, ADR 0003 (supersedes ADR 0002); the tag on taxRate names ADR 0003   branch "regional"
#   c4 main     money.ts formatCents with separators; the message names ADR 0001 in free text only (no link)
#   c5 main     merge of "regional"
#   c6 main     lib.rs: a Rust symbol (memod reads no symbol uses in Rust); trailer "Decision: ADR-0001"
#   c7 main     decisions/notes.json: a second decisions source citing c2 and c4 by short id
#   c8 main     renames the amount parameter of five symbols: a large commit with trailer "Decision: ADR-0001"
# Tests and the demo share this fixture; change it only with docs/failures.md.
set -euo pipefail
dir=${1:?usage: fixture.sh <folder>}
[ ! -e "$dir" ] || { echo "fixture.sh: $dir exists" >&2; exit 1; }
mkdir -p "$dir"
cd "$dir"
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
git init -q -b main
at() { export GIT_AUTHOR_DATE="2026-01-0$1T12:00:00+00:00" GIT_COMMITTER_DATE="2026-01-0$1T12:00:00+00:00"; }
# commit <subject> [<paragraph>]...: each argument is one paragraph of the message.
commit() { local m=(); for p in "$@"; do m+=(-m "$p"); done; git add -A && git commit -q "${m[@]}"; }
mkdir -p src docs/adr

at 1
cat > src/money.ts <<'EOF'
/**
 * module: [[fx-money]]
 */

/**
 * owns: [[fx-money]]
 * decided: amounts are integer cents because floats round 0.1 + 0.2 wrong (adr-0001)
 */
export function cents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * owns: [[fx-money]]
 */
export function formatCents(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
EOF
cat > src/cart.ts <<'EOF'
/**
 * module: [[fx-cart]]
 */
import { cents, formatCents } from "./money.ts";

/**
 * owns: [[fx-cart]]
 */
export function total(prices: readonly number[]): string {
  return formatCents(prices.map(cents).reduce((a, b) => a + b, 0));
}
EOF
cat > docs/adr/0001-money-in-cents.md <<'EOF'
# ADR 0001: Money in cents

Date: 2026-01-01. Status: accepted. Topic: [[fx-money]].

## Context

Prices arrive as decimal numbers.

## Choice

Store and add every amount as integer cents.
EOF
commit "Add money and cart in cents"

at 2
cat > src/tax.ts <<'EOF'
/**
 * module: [[fx-tax]]
 * decided: tax lives apart from the cart because rates change by law, not by product (ADR-0002)
 */
import { cents } from "./money.ts";

/**
 * owns: [[fx-tax]]
 */
export function taxRate(): number {
  return 0.2;
}

/**
 * owns: [[fx-tax]]
 */
export function taxOf(amount: number): number {
  return Math.round(cents(amount) * taxRate());
}
EOF
cat > docs/adr/0002-flat-tax.md <<'EOF'
# ADR 0002: One flat tax rate

Date: 2026-01-02. Status: accepted. Topic: [[fx-tax]].

## Context

Tax is computed on cents (ADR 0001).

## Choice

One rate for every order.
EOF
commit "Add a flat tax"

git checkout -q -b regional
at 3
cat > src/tax.ts <<'EOF'
/**
 * module: [[fx-tax]]
 * decided: tax lives apart from the cart because rates change by law, not by product (ADR-0002)
 */
import { cents } from "./money.ts";

/**
 * owns: [[fx-tax]]
 * decided: the rate depends on the region because ADR 0003 replaced the flat rate
 */
export function taxRate(region = "eu"): number {
  return region === "eu" ? 0.2 : 0.1;
}

/**
 * owns: [[fx-tax]]
 */
export function taxOf(amount: number): number {
  return Math.round(cents(amount) * taxRate());
}
EOF
cat > docs/adr/0003-regional-tax.md <<'EOF'
# ADR 0003: Tax rate by region

Date: 2026-01-03. Status: accepted. Topic: [[fx-tax]].

Supersedes ADR 0002.

## Context

Orders now ship outside the EU. Amounts stay in cents (ADR 0001).

## Choice

The rate depends on the region of the order.
EOF
commit "Tax rate by region"

git checkout -q main
at 4
cat > src/money.ts <<'EOF'
/**
 * module: [[fx-money]]
 */

/**
 * owns: [[fx-money]]
 * decided: amounts are integer cents because floats round 0.1 + 0.2 wrong (adr-0001)
 */
export function cents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * owns: [[fx-money]]
 */
export function formatCents(value: number): string {
  const whole = Math.floor(value / 100).toLocaleString("en-US");
  return `${whole}.${String(value % 100).padStart(2, "0")}`;
}
EOF
commit "Format cents with thousands separators (ADR 0001)"

at 5
git merge -q --no-ff -m "Merge branch 'regional'" regional

at 6
cat > src/lib.rs <<'EOF'
//! module: [[fx-native]]

/// owns: [[fx-native]]
pub fn round_cents(amount: f64) -> i64 {
    (amount * 100.0).round() as i64
}
EOF
commit "Add Rust rounding" "Decision: ADR-0001"

at 7
mkdir -p decisions
c2=$(git log --format=%h -1 --grep '^Add a flat tax$')
c4=$(git log --format=%h -1 --grep '^Format cents')
cat > decisions/notes.json <<EOF
{
  "records": [
    {
      "id": "note-1",
      "date": "2026-01-02",
      "title": "Tax is computed once per order, not per line",
      "items": [{ "label": "decided", "text": "tax once per order because per-line rounding adds up to a cent per line" }],
      "topics": ["fx-tax"],
      "restsOn": ["ADR-0002"],
      "commits": ["$c2"]
    },
    {
      "id": "note-2",
      "date": "2026-01-04",
      "title": "Show thousands separators in totals",
      "items": [{ "label": "decided", "text": "en-US separators because the shop sells in USD first" }],
      "topics": ["fx-money"],
      "restsOn": ["note-1"],
      "commits": ["$c4"]
    }
  ]
}
EOF
commit "Record notes from the design review"

at 8
cat > src/money.ts <<'EOF'
/**
 * module: [[fx-money]]
 */

/**
 * owns: [[fx-money]]
 * decided: amounts are integer cents because floats round 0.1 + 0.2 wrong (adr-0001)
 */
export function cents(units: number): number {
  return Math.round(units * 100);
}

/**
 * owns: [[fx-money]]
 */
export function formatCents(inCents: number): string {
  const whole = Math.floor(inCents / 100).toLocaleString("en-US");
  return `${whole}.${String(inCents % 100).padStart(2, "0")}`;
}
EOF
cat > src/cart.ts <<'EOF'
/**
 * module: [[fx-cart]]
 */
import { cents, formatCents } from "./money.ts";

/**
 * owns: [[fx-cart]]
 */
export function total(unitPrices: readonly number[]): string {
  return formatCents(unitPrices.map(cents).reduce((a, b) => a + b, 0));
}
EOF
cat > src/tax.ts <<'EOF'
/**
 * module: [[fx-tax]]
 * decided: tax lives apart from the cart because rates change by law, not by product (ADR-0002)
 */
import { cents } from "./money.ts";

/**
 * owns: [[fx-tax]]
 * decided: the rate depends on the region because ADR 0003 replaced the flat rate
 */
export function taxRate(region = "eu"): number {
  return region === "eu" ? 0.2 : 0.1;
}

/**
 * owns: [[fx-tax]]
 */
export function taxOf(units: number): number {
  return Math.round(cents(units) * taxRate());
}
EOF
cat > src/lib.rs <<'EOF'
//! module: [[fx-native]]

/// owns: [[fx-native]]
pub fn round_cents(units: f64) -> i64 {
    (units * 100.0).round() as i64
}
EOF
commit "Name every amount by its unit" "Decision: ADR-0001"
git log --format='%h %ad %s' --date=short --graph
