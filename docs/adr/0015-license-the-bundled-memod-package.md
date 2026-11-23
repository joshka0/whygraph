# ADR 0015. License the bundled memod package under MIT

Topic: [[whygraph-entry-packaging]]

## Context

[ADR 0014](0014-distribute-the-shop-graph.md) bundles memod as
`vendor/memod-0.2.0.tgz`. The tarball had no license file, and its
`package.json` had no `license` field. The memod source repo is private.
A reader could not tell which terms cover the bundled package. The
contest rules allow reused code and third-party material "if you have
the right to use them and comply with their licenses".

## Options

- Put a license file next to the tarball in `vendor/`. An installed copy
  in `node_modules/memod` then has no license.
- Put the license in the tarball. Each copy of the package then carries
  its terms.
- Publish the memod source repo with a license. Its history is not
  checked for private text.

## Choice

The author of memod licenses the bundled package under MIT (decided
2026-11-23). The tarball now holds `package/LICENSE`, with the same text
as the whygraph [LICENSE](../../LICENSE), and `"license": "MIT"` in
`package/package.json`. Each other file of the tarball keeps the bytes
packed from memod commit `d0b4d689225899a458647948b680176dd83ea830`.
The lockfile holds the new integrity hash of the tarball.

## Consequences

The README names memod as reused code and cites this license. The memod
source repo has no license file on 2026-11-23. Future work: add the same
`LICENSE` and `license` field to the memod repo before the next tarball
rebuild. A rebuild from a memod revision without them removes the
license from the bundle.
