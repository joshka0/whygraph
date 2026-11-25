# ADR 0014. Distribute the shop graph and its build tools

Date: 2026-11-20. Status: accepted. Topic: [[whygraph-entry-packaging]].

## Context

A reader needs to open the shop graph from a clone and build it from
source. The previous lockfile required a separate memod checkout at the
author's local path.

## Options

The reader could clone and compile memod, or whygraph could ship the
compiled CLI from the pinned commit. The reader could also build the
shop before the first query, or open a copy of its store.

## Choice

Distribute whygraph under MIT. Pack memod's compiled JavaScript from
`d0b4d689225899a458647948b680176dd83ea830` in
`vendor/memod-0.2.0.tgz`. Pin the tarball as a runtime dependency.
Commit the fixture store as `examples/shop.rl`, which Relate opens
read-only. Keep Git history available for builds and historical checks.

## Consequences

The first query requires only the Relate CLI and the bundled store.
A source build also requires the dependencies in the lockfile and the
embedding model. When the memod revision changes, rebuild its tarball
and update the lockfile. When the shop data changes, rebuild its store
from the fixture and both decision sources.
