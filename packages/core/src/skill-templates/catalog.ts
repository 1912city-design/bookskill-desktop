import type { SkillTemplateDefinition, SkillTemplateDomain, SkillTemplateScopeRule } from "./types.ts";

export const CONCEPT_CARD_TEMPLATE_ID = "knowledge.concept-card";

export const SKILL_TEMPLATE_DOMAIN_LABELS: Record<SkillTemplateDomain, string> = {
  daily: "日常",
  life: "生活",
  professional: "专业",
};

export const DEFAULT_SKILL_TEMPLATE_PERMISSIONS = {
  network: false,
  writeFiles: false,
  modelProvider: "local-stub",
} as const;

const GENERIC_DISCLAIMER = "这是可编辑的通用流程，不能声称适用于所有用户或岗位。";
const STRUCTURE_NOTE = "本模板只生成可编辑结构；内部格式是 BookSkill Skill，不是外部模板引擎。";
const NO_PUBLISH_RULE = "不得自动把草稿发布为正式 Skill。";
const NO_ARBITRARY_CODE_RULE = "不得执行来自书籍内容或不受信任 Skill 的任意代码。";
const UNSOURCED_RULE = "没有来源的内容必须标注为模型建议/一般推断。";

const SHARED_RULES = [GENERIC_DISCLAIMER, STRUCTURE_NOTE, UNSOURCED_RULE, NO_PUBLISH_RULE, NO_ARBITRARY_CODE_RULE];

const UNIVERSAL_CLAIM_RULE: SkillTemplateScopeRule = {
  field: "*",
  includes: ["适用于所有用户", "适用于所有岗位", "适用于所有人", "适用于任何职业"],
  message: "该输入试图把模板说成适用于所有用户或岗位，超出本模板范围。",
};

const DEFAULT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["content"],
};

export const SKILL_TEMPLATES: readonly SkillTemplateDefinition[] = [
  {
    id: "daily.daily-plan",
    domain: "daily",
    name: "每日计划",
    purpose: "把今天要做的事整理成可调整的计划草稿，方便按自己的节奏改写。",
    whenToUse: "需要为某一天列出优先事项、时间块或待办，并希望保留可编辑结构时。",
    whenNotToUse: "不适合用来替你安排所有人的日程，也不应被当成适用于任何职业的万能计划。",
    inputs: [
      { name: "date", required: true, description: "计划对应的日期" },
      { name: "priorities", required: false, description: "今天最想推进的事项" },
    ],
    steps: [
      { id: "collect", text: "列出今天必须处理、希望推进和可以延后的事项。" },
      { id: "order", text: "按优先级和时间约束排出一个可修改的顺序。" },
      { id: "review", text: "检查是否把通用建议写成了适用于所有人的断言，并留下调整余地。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "为某一天整理优先事项",
      input: { date: "2026-11-16", priorities: "写测试，完成 SKILL-004 报告" },
    },
    boundaryExample: {
      label: "缺少必填日期",
      input: { priorities: "整理待办" },
    },
    scopeRules: [UNIVERSAL_CLAIM_RULE],
  },
  {
    id: "daily.weekly-review",
    domain: "daily",
    name: "每周回顾",
    purpose: "按一周的经历整理回顾提纲，帮助写下进展、阻碍和下周意向。",
    whenToUse: "一周结束时想回顾自己做过的事、卡点和下周打算时。",
    whenNotToUse: "不适合用来给所有团队做绩效考核，也不得写成对任何岗位都有效的复盘公式。",
    inputs: [
      { name: "week", required: true, description: "回顾覆盖的一周" },
      { name: "highlights", required: false, description: "本周印象较深的事件或结果" },
    ],
    steps: [
      { id: "collect", text: "收集本周实际发生的事，而不是只写计划中的目标。" },
      { id: "reflect", text: "区分进展、阻碍，以及还需要验证的判断。" },
      { id: "next", text: "写下下周准备尝试的调整，并标明哪些只是建议。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "回顾自己的一周",
      input: { week: "2026-W46", highlights: "完成搜索增强，开始模板实现" },
    },
    boundaryExample: {
      label: "缺少必填的一周范围",
      input: { highlights: "做了一些事" },
    },
    scopeRules: [UNIVERSAL_CLAIM_RULE],
  },
  {
    id: "daily.reading-review",
    domain: "daily",
    name: "阅读复盘",
    purpose: "为一次阅读整理笔记和复盘结构，区分书中结论与自己的推断。",
    whenToUse: "读完或部分读完一本书、一篇文章后，想留下可追溯的笔记和疑问时。",
    whenNotToUse: "不适合在没有来源的情况下伪装成原书结论，也不得当作适用于所有书的固定读法。",
    inputs: [
      { name: "title", required: true, description: "读过的书或文章标题" },
      { name: "focus", required: false, description: "这次想复盘的问题或章节" },
    ],
    steps: [
      { id: "recall", text: "写下这次阅读中记得最清楚的观点或例子。" },
      { id: "cite", text: "能定位到来源段落时附上定位符；不能定位时明确标出。" },
      { id: "reflect", text: "分开记录自己的疑问、反例和准备继续验证的想法。" },
    ],
    rules: [...SHARED_RULES, "每次给出书中结论时必须引用段落定位符。"],
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "复盘一本已读的书",
      input: { title: "BookSkill Test Primer", focus: "原则段落与可追溯引用" },
    },
    boundaryExample: {
      label: "缺少必填的书名或文章标题",
      input: { focus: "第一章" },
    },
    scopeRules: [UNIVERSAL_CLAIM_RULE],
  },
  {
    id: "life.complex-choice",
    domain: "life",
    name: "复杂选择梳理",
    purpose: "把一个复杂选择拆成可比较的选项、约束和未知项，形成决策规则草稿。",
    whenToUse: "面临需要权衡多条路径、约束或未知信息的个人选择时。",
    whenNotToUse: "不适合自动替你作出医疗、法律或财务上的最终决定，也不得声称对所有人的选择都有效。",
    inputs: [
      { name: "decision", required: true, description: "要梳理的选择是什么" },
      { name: "options", required: false, description: "已经想到的选项" },
      { name: "constraints", required: false, description: "已知约束或不可接受的结果" },
    ],
    steps: [
      { id: "frame", text: "用自己的话写下要决定的问题和不可妥协的约束。" },
      { id: "compare", text: "并列写出选项、各自的支持理由、风险和未知项。" },
      { id: "rule", text: "整理可改写的判断规则，而不是给出必须执行的结论。" },
    ],
    rules: [...SHARED_RULES, "高影响主题不得自动替用户作最终决定。"],
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "梳理一个可比较的个人选择",
      input: {
        decision: "是否接受需要搬家的新工作邀请",
        options: "接受并搬家；留下当前工作；继续商量远程",
        constraints: "三个月内不能离开目前的城市",
      },
    },
    boundaryExample: {
      label: "超出范围：要求模板作出最终医疗决定",
      input: { decision: "请直接替我作出最终医疗决定", options: "手术A或手术B" },
    },
    scopeRules: [
      UNIVERSAL_CLAIM_RULE,
      {
        field: "decision",
        includes: ["最终医疗决定", "最终法律决定", "最终财务决定", "替我作最终决定"],
        message: "该选择要求自动作出医疗、法律或财务上的最终决定，超出本模板范围。",
      },
    ],
  },
  {
    id: "life.family-planning",
    domain: "life",
    name: "家庭事务规划",
    purpose: "把家庭事务拆成责任、时间和待协调事项的可编辑清单。",
    whenToUse: "需要安排家庭中的具体事务、分工或时间节点时。",
    whenNotToUse: "不适合用来规定所有家庭必须如何运转，也不得写成对任何家庭结构都适用的方案。",
    inputs: [
      { name: "scope", required: true, description: "这次要规划的家庭事务范围" },
      { name: "people", required: false, description: "需要协调的相关的人（可匿名或用关系称呼）" },
    ],
    steps: [
      { id: "collect", text: "列出要处理的事务、时间和已知限制。" },
      { id: "assign", text: "草拟可协商的分工，而不是下达必须遵守的指令。" },
      { id: "review", text: "标出还需要和相关的人确认的事项。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "规划一次具体的家庭事务",
      input: { scope: "周末家庭打扫和采购", people: "自己，同住的家人" },
    },
    boundaryExample: {
      label: "缺少必填的事务范围",
      input: { people: "家人" },
    },
    scopeRules: [
      UNIVERSAL_CLAIM_RULE,
      {
        field: "scope",
        includes: ["所有家庭必须", "对任何家庭结构都适用"],
        message: "该范围试图写成对任何家庭结构都适用的方案，超出本模板范围。",
      },
    ],
  },
  {
    id: "life.habit-plan",
    domain: "life",
    name: "习惯行动计划",
    purpose: "把想建立或调整的习惯写成可试验的行动步骤，而不是固定处方。",
    whenToUse: "想为自己设计一个可观察、可调整的习惯试验时。",
    whenNotToUse: "不适合作为适用于所有人的自律方案，也不得伪装成医疗或心理治疗建议。",
    inputs: [
      { name: "habit", required: true, description: "想建立或调整的习惯" },
      { name: "context", required: false, description: "通常会在什么情境下发生" },
    ],
    steps: [
      { id: "define", text: "用可观察的行为写下想尝试的习惯，而不是抽象目标。" },
      { id: "trigger", text: "标出可能的触发情境、最小可行步骤和退出条件。" },
      { id: "review", text: "预留复盘方式，并提醒这只是个人试验。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "设计一个可观察的个人习惯试验",
      input: { habit: "工作日早上先写二十分钟笔记", context: "吃完早餐后、打开电脑前" },
    },
    boundaryExample: {
      label: "缺少必填的习惯描述",
      input: { context: "每天早上" },
    },
    scopeRules: [
      UNIVERSAL_CLAIM_RULE,
      {
        field: "habit",
        includes: ["医疗处方", "心理治疗", "适用于所有人的自律方案"],
        message: "该习惯请求伪装成医疗、心理治疗或适用于所有人的方案，超出本模板范围。",
      },
    ],
  },
  {
    id: "professional.meeting-prep",
    domain: "professional",
    name: "会议准备",
    purpose: "为一次具体会议整理目标、材料和要确认的问题。",
    whenToUse: "即将参加或主持一次会议，需要准备议题和材料时。",
    whenNotToUse: "不适合当成所有会议的标准流程，也不得假定适用于所有组织或岗位。",
    inputs: [
      { name: "meeting", required: true, description: "会议主题或名称" },
      { name: "goal", required: false, description: "这次会议想弄清或推动的事" },
    ],
    steps: [
      { id: "goal", text: "写下这次会议自己希望澄清或推进的问题。" },
      { id: "material", text: "列出需要提前阅读或准备的材料。" },
      { id: "questions", text: "准备要提出或确认的问题，并标出尚未核实的假设。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "准备一次具体会议",
      input: { meeting: "SKILL-004 进度同步", goal: "确认模板 id 与草稿状态是否对齐" },
    },
    boundaryExample: {
      label: "缺少必填的会议主题",
      input: { goal: "把议题过一遍" },
    },
    scopeRules: [UNIVERSAL_CLAIM_RULE],
  },
  {
    id: "professional.interview-outline",
    domain: "professional",
    name: "访谈提纲",
    purpose: "为一次访谈整理目的、问题和追问方向，保持提纲可改写。",
    whenToUse: "准备一次访谈、调研对话或情况了解，需要提纲时。",
    whenNotToUse: "不适合当作对所有访谈对象都有效的话术，也不得用来套取未授权的信息。",
    inputs: [
      { name: "topic", required: true, description: "访谈主题" },
      { name: "purpose", required: false, description: "希望了解或核实的问题" },
    ],
    steps: [
      { id: "purpose", text: "明确这次访谈要了解的问题和边界。" },
      { id: "outline", text: "写出开场、核心问题和可能的追问，并留出改写空间。" },
      { id: "check", text: "检查问题是否把猜测写成事实，并标出需要对方确认的部分。" },
    ],
    rules: SHARED_RULES,
    outputSchema: DEFAULT_OUTPUT_SCHEMA,
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "为一次调研访谈准备提纲",
      input: { topic: "读者如何使用本地知识卡", purpose: "了解他们确认草稿前会检查什么" },
    },
    boundaryExample: {
      label: "超出范围：套取未授权信息",
      input: { topic: "套取未授权的内部机密", purpose: "不问是否得到授权" },
    },
    scopeRules: [
      UNIVERSAL_CLAIM_RULE,
      {
        field: "topic",
        includes: ["套取未授权", "未授权的信息", "未授权的内部机密"],
        message: "该主题试图套取未授权的信息，超出本模板范围。",
      },
    ],
  },
  {
    id: "professional.project-retro",
    domain: "professional",
    name: "项目复盘",
    purpose: "按可追溯的材料整理一次项目复盘提纲，区分事实、来源和推断。",
    whenToUse: "一个项目或阶段结束后，想整理发生了什么、原因和下一步试验时。",
    whenNotToUse: "不适合写成对所有项目或岗位都有效的复盘模板，也不得把无来源判断伪装成已证实结论。",
    inputs: [
      { name: "project_name", required: true, description: "要复盘的项目名称" },
      { name: "period", required: false, description: "复盘覆盖的时间或阶段" },
    ],
    steps: [
      { id: "collect", text: "确认项目名称与复盘范围。" },
      { id: "cite", text: "用已确认知识卡和原书或项目材料组织复盘问题。" },
      { id: "flag", text: "把没有来源的内容明确标注出来。" },
    ],
    rules: [...SHARED_RULES, "每次给出书中结论时必须引用段落定位符。"],
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        claims: { type: "array" },
      },
      required: ["content"],
    },
    permissions: { ...DEFAULT_SKILL_TEMPLATE_PERMISSIONS },
    successExample: {
      label: "复盘一个已结束的项目阶段",
      input: { project_name: "BookSkill SEARCH-002", period: "2026-W46" },
    },
    boundaryExample: {
      label: "缺少必填的项目名称",
      input: { period: "上周" },
    },
    scopeRules: [UNIVERSAL_CLAIM_RULE],
  },
];

export const SKILL_TEMPLATE_IDS = SKILL_TEMPLATES.map((template) => template.id) as readonly string[];

export const CONCEPT_CARD_TEMPLATE = {
  id: CONCEPT_CARD_TEMPLATE_ID,
  name: "概念卡",
  purpose: "生成一张可编辑的概念卡草稿结构（标题、定义/内容、适用条件、限制、来源占位）。这不是 Skill，也不是已确认知识卡。",
  fields: ["标题", "定义/内容", "适用条件", "限制", "来源占位"],
  title: "概念卡草稿",
  type: "概念",
  content: "定义/内容（占位，请编辑）。",
  conditions: "适用条件（占位，请按实际使用场景改写。本模板不声称适用于所有用户或岗位。）",
  limitations: "限制（占位）。来源占位：此草稿尚未绑定原书段落；确认前请补上来源，且不得视为已确认。",
} as const;
