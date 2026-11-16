# SKILL-FUSE-001：对话沉淀与 Skill 融合（P2）

- ID：SKILL-FUSE-001
- 阶段：E
- 目标：对话后可手动把新知识点沉淀为草稿；提供「融合两个 Skill」操作，输出新的 draft Skill 并可在对话中绑定调用。
- 负责人 Agent：ai_skill_engineer
- 依赖：DISTILL-001、SKILL-001、COUNCIL-001
- 状态：Backlog
- 风险等级（预估）：中（融合只追加新 Skill 版本/新 Skill，不改写旧版本；D-018：融合结果必须是 draft，发布须用户确认）
- 验收条件（草稿）：手动触发两个已有 Skill 的融合，得到新的 draft Skill，可绑定到对话；旧 Skill 仍在且未被改写。独立 QA 通过前不得合入，不得宣布完成。
