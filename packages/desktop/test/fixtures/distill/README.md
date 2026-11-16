# Locked distill fixtures (read-only copies)

These are copies of the locked 5-segment template and the three accepted distillations,
copied from the DISTILL-001 fixture set for DISTILL-002 tests. Do not modify the originals:

- `/workspace/书籍蒸馏工作台/依据/蒸馏提示词模板.md`
- `/workspace/书籍蒸馏工作台/交付/孙子兵法_蒸馏结果.md`
- `/workspace/书籍蒸馏工作台/交付/论语_蒸馏结果.md`
- `/workspace/书籍蒸馏工作台/交付/道德经_蒸馏结果.md`

Do not rewrite the DISTILL-001 copies in place. Do not rewrite the section titles.
The locked 5 sections are:

1. 核心定位
2. 原则与应用
3. 金句
4. 应用框架
5. 可调用Skill

Expected SHA-256 (also in SHA256SUMS):

- 蒸馏提示词模板.md `7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`
- 孙子兵法_蒸馏结果.md `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- 论语_蒸馏结果.md `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- 道德经_蒸馏结果.md `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

If a hash drifts, stop and report; do not "fix" the original assets.

Synthetic files in this directory (`synthetic-*.md`) are local validation-failure
fixtures only. They are not locked originals and must not be used to rewrite the three accepted books.
