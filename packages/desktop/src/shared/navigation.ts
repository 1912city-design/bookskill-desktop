export const ROUTE_IDS = [
  "chat",
  "library",
  "knowledge",
  "skills",
  "settings",
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

export type NavItem = {
  id: RouteId;
  label: string;
  title: string;
  description: string;
};

/**
 * Five first-level product entries. Labels match the execution contract.
 * Default entry is 问题对话 (chat).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "chat",
    label: "问题对话",
    title: "问题对话",
    description: "从这里向书中的知识提问。可指定 Skill、书籍或知识卡作为本次上下文。本页是骨架占位，端到端对话将在后续切片接入。",
  },
  {
    id: "library",
    label: "书库",
    title: "书库",
    description: "导入并管理 PDF、EPUB、Markdown 和 TXT。本页是骨架占位，导入与阅读将在后续任务接入。",
  },
  {
    id: "knowledge",
    label: "知识库",
    title: "知识库",
    description: "查看概念、原则、方法、案例、问题与个人洞察。本页是骨架占位，知识卡将在后续任务接入。",
  },
  {
    id: "skills",
    label: "Skills",
    title: "Skills",
    description: "浏览、编写和试用 Skill。本页是骨架占位，Skill Studio 将在后续任务接入。",
  },
  {
    id: "settings",
    label: "设置与数据",
    title: "设置与数据",
    description: "查看本机数据目录、备份与应用信息。BookSkill 使用独立的产品数据目录，不会读写 AnythingLLM 的默认用户目录。",
  },
];

export const DEFAULT_ROUTE_ID: RouteId = "chat";

export function isRouteId(value: string): value is RouteId {
  return (ROUTE_IDS as readonly string[]).includes(value);
}

export function getNavItem(id: RouteId): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`Unknown route: ${id}`);
  }
  return item;
}

export type NavigationState = {
  readonly current: RouteId;
  readonly currentItem: NavItem;
  readonly items: readonly NavItem[];
  go(id: string): RouteId;
};

export function createNavigationState(initial?: RouteId): NavigationState {
  let current: RouteId = initial ?? DEFAULT_ROUTE_ID;
  return {
    get current(): RouteId {
      return current;
    },
    get currentItem(): NavItem {
      return getNavItem(current);
    },
    items: NAV_ITEMS,
    go(id: string): RouteId {
      if (!isRouteId(id)) {
        throw new Error(`Unknown route: ${id}`);
      }
      current = id;
      return current;
    },
  };
}
