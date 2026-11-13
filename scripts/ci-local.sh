#!/usr/bin/env bash
# Local equivalent of .github/workflows/ci.yml (lint, test, build).
# This does not talk to GitHub Actions. A failing unit test exits non-zero.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  echo "pnpm-lock.yaml is missing; running an unfrozen install to create it." >&2
  pnpm install
fi

pnpm lint
pnpm test
pnpm build
