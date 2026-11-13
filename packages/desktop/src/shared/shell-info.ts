import type { NavItem, RouteId } from "./navigation.ts";

export type ShellInfo = {
  productName: string;
  version: string;
  dataDir: string;
  defaultRouteId: RouteId;
  routes: readonly NavItem[];
};

export type BookskillDesktopBridge = {
  getShellInfo: () => Promise<ShellInfo>;
};
