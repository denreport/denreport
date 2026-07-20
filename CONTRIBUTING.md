# Contributing to denreport

Thanks for your interest in denreport. This document covers how to set up
the project, run the checks, and submit a change.

## Development environment

Requirements: Node.js >= 24 and [pnpm](https://pnpm.io/) via
[Corepack](https://nodejs.org/api/corepack.html).

```sh
git clone https://github.com/denreport/denreport.git
cd denreport
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
```

Run the reference web app:

```sh
pnpm --filter @denreport/web dev
```

## Running checks

```sh
pnpm lint        # biome
pnpm typecheck   # tsc, per package
pnpm test        # vitest, per package
pnpm check       # lint + typecheck + test + comment-reference check + version-sync check
```

Run a single package's tests, e.g. the core package:

```sh
pnpm --filter @denreport/core test
```

CI also runs three additional jobs that are not part of `pnpm check`:
`reportlab-exec` (a ReportLab output-equivalence check), `container-smoke`
(builds the Docker image and hits its `/healthz` endpoint), and `e2e` (a
Playwright end-to-end suite). `reportlab-exec` and `e2e` require a Python
3.12 environment with `reportlab`, `pillow`, and `pypdf` installed (see
`.github/workflows/ci.yml` for the exact versions); `container-smoke` only
needs Docker. You don't need to run these locally to submit a PR — CI will
run them.

## Code comments

Comments should explain a "why" that isn't obvious from the code itself, not
restate what the next line does, and should not reference internal design
documents. `scripts/check-comment-refs.sh` enforces the latter as part of
`pnpm check`.

## Submitting a pull request

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests for new behavior.
3. Run `pnpm check` and make sure it passes.
4. Open a pull request describing the change and, for bug fixes, how to
   reproduce the issue it fixes.

All CI checks must pass before a PR is merged.

## Licensing of contributions

All packages in denreport are MIT licensed (see the License section of
[README.md](README.md)), and contributions are accepted under the same
license.

Every contribution must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/) (DCO).
Add `Signed-off-by` to each commit with `git commit -s`, certifying that you
wrote the change or otherwise have the right to submit it under the
project's license.
