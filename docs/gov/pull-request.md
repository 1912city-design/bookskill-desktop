# Local pull request draft — GOV-001

This is a **local** PR draft only. It must not be pushed, opened against a remote, or merged into `main` or `integration` until the orchestrator and the responsible human say so. No publishing repository is connected at the time of this draft.

## Title

docs(gov): record GOV-001 upstream license inventory for AnythingLLM

## Source / target

- Source branch: `feat/GOV-001`
- Intended local target (when the orchestrator integrates): `integration` (not `main`)
- Worktree: `/workspace/bookskill-worktrees/GOV-001`
- Do not include `/workspace/bookskill-upstream/anything-llm` in the merge

## Summary

Read-only audit of [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) at `1626d971c73d70a68602a662e3baf52e160c62ff` (`master`, describe `v1.19.0-123-g1626d971`), checked out 2026-11-13 17:12:17 Asia/Shanghai.

The change adds license inventories, excerpts, a list of questions for human counsel, and `docs/licenses/verify_gov001.py`. It does not change application code, CI, or the official desktop binary (which is out of scope and must not be redistributed).

The root upstream license is MIT. That fact is a starting point only. This draft does not authorize a public BookSkill release.

## Test plan

```bash
cd /workspace/bookskill-worktrees/GOV-001
python3 docs/licenses/verify_gov001.py
# expect exit code 0, and no claim that public release is authorized
```

## Reviewer notes

- Please read `docs/licenses/legal-questions.md` (L-001 through L-012) before any packaging discussion.
- Font, trademark, model, CDN binary, LGPL/MPL, and official Desktop terms are called out separately from the MIT root license.
- Unknown items are labeled `UNKNOWN`.
