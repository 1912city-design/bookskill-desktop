import { openSliceWorkspace, type SliceWorkspace } from "@bookskill/core";
import { resolveBusinessDbPath } from "@bookskill/data";
import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDataDir } from "../shared/data-layout.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../shared/navigation.ts";
import { PRODUCT_NAME, PRODUCT_VERSION } from "../shared/product.ts";
import type { ShellInfo, SliceSnapshotInfo } from "../shared/shell-info.ts";

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_DIR = path.join(MAIN_DIR, "../renderer");
const PRELOAD_PATH = path.join(MAIN_DIR, "preload.cjs");

type SmokeOptions = {
  enabled: boolean;
  outPath: string | null;
};

type BootState = {
  dataDir: string;
  bootError: string | null;
  businessDbPath: string;
  schemaVersion: number | null;
  slice: SliceSnapshotInfo | null;
  sliceError: string | null;
};

let mainWindow: BrowserWindow | null = null;
let sliceWorkspace: SliceWorkspace | null = null;
let bootState: BootState = {
  dataDir: "",
  bootError: null,
  businessDbPath: "",
  schemaVersion: null,
  slice: null,
  sliceError: null,
};

function parseSmokeOptions(argv: string[]): SmokeOptions {
  const enabled = argv.includes("--smoke");
  const flag = argv.find((arg) => arg.startsWith("--smoke-out="));
  const outPath = flag ? flag.slice("--smoke-out=".length) : null;
  return { enabled, outPath };
}

function shouldRelaxChromiumSandbox(): boolean {
  if (process.env.BOOKSKILL_ELECTRON_NO_SANDBOX === "1") {
    return true;
  }
  if (process.argv.includes("--smoke")) {
    return true;
  }
  if (process.env.CI === "true" || process.env.CI === "1") {
    return true;
  }
  if (process.getuid?.() === 0) {
    return true;
  }
  return fs.existsSync("/.dockerenv");
}

function applyChromiumFlags(): void {
  // Container / CI environments often cannot use /dev/shm the way Chromium expects.
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  if (!shouldRelaxChromiumSandbox()) {
    return;
  }
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("no-zygote");
  app.commandLine.appendSwitch("disable-gpu");
  app.disableHardwareAcceleration();
}

function writeSmokeResult(outPath: string | null, payload: unknown): void {
  if (!outPath) {
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createMainWindow(bootError: string | null): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: PRODUCT_NAME,
    backgroundColor: "#F6F1E8",
    autoHideMenuBar: true,
    show: !process.argv.includes("--smoke"),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  const query: Record<string, string> = {};
  if (bootError) {
    query.bootError = bootError;
  }
  void window.loadFile(path.join(RENDERER_DIR, "index.html"), { query });
  window.once("ready-to-show", () => {
    if (!process.argv.includes("--smoke")) {
      window.show();
    }
  });
  return window;
}

async function runSmokeInspection(window: BrowserWindow, smoke: SmokeOptions, dataDir: string): Promise<void> {
  try {
    await window.webContents.executeJavaScript("document.readyState", true);
    const snapshot = (await window.webContents.executeJavaScript(
      `(() => {
        const productName = document.querySelector('[data-testid="product-name"]')?.textContent?.trim() ?? null;
        const activeView = document.querySelector('[data-testid="active-view"]');
        const errorBoundary = document.querySelector('[data-testid="error-boundary"]');
        const navButtons = [...document.querySelectorAll("[data-nav-id]")].map((el) => ({
          id: el.getAttribute("data-nav-id"),
          label: el.textContent?.trim() ?? "",
          ariaCurrent: el.getAttribute("aria-current"),
        }));
        return {
          title: document.title,
          productName,
          defaultRouteId: activeView?.getAttribute("data-route") ?? null,
          defaultViewLabel: activeView?.querySelector('[data-testid="view-title"]')?.textContent?.trim() ?? null,
          navButtons,
          hasErrorBoundary: Boolean(errorBoundary),
        };
      })()`,
      true,
    )) as Record<string, unknown>;

    writeSmokeResult(smoke.outPath, {
      ok: true,
      productName: PRODUCT_NAME,
      dataDir,
      snapshot,
    });
    app.exit(0);
  } catch (error) {
    writeSmokeResult(smoke.outPath, {
      ok: false,
      dataDir,
      error: error instanceof Error ? error.message : String(error),
    });
    app.exit(1);
  }
}

async function boot(): Promise<void> {
  const smoke = parseSmokeOptions(process.argv);
  applyChromiumFlags();
  app.setName(PRODUCT_NAME);

  try {
    const initialized = initializeDataDir();
    let businessDbPath = "";
    let schemaVersion: number | null = null;
    let slice: SliceSnapshotInfo | null = null;
    let sliceError: string | null = null;
    try {
      businessDbPath = resolveBusinessDbPath();
      sliceWorkspace = openSliceWorkspace();
      businessDbPath = sliceWorkspace.dbPath;
      schemaVersion = sliceWorkspace.schemaVersion;
      slice = sliceWorkspace.snapshot();
    } catch (error) {
      sliceError = error instanceof Error ? error.message : String(error);
    }
    bootState = {
      dataDir: initialized.dataDir,
      bootError: null,
      businessDbPath,
      schemaVersion,
      slice,
      sliceError,
    };
    app.setPath("userData", path.join(initialized.dataDir, "electron-user-data"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootState = {
      dataDir: "",
      bootError: message,
      businessDbPath: "",
      schemaVersion: null,
      slice: null,
      sliceError: message,
    };
    if (smoke.enabled) {
      writeSmokeResult(smoke.outPath, { ok: false, error: message });
      app.exit(1);
      return;
    }
  }

  const shellInfo: ShellInfo = {
    productName: PRODUCT_NAME,
    version: PRODUCT_VERSION,
    dataDir: bootState.dataDir,
    defaultRouteId: DEFAULT_ROUTE_ID,
    routes: NAV_ITEMS,
    businessDbPath: bootState.businessDbPath,
    schemaVersion: bootState.schemaVersion,
    slice: bootState.slice,
    sliceError: bootState.sliceError,
  };

  ipcMain.handle("shell:getInfo", () => shellInfo);

  await app.whenReady();
  mainWindow = createMainWindow(bootState.bootError);

  if (smoke.enabled) {
    mainWindow.webContents.once("did-finish-load", () => {
      void runSmokeInspection(mainWindow!, smoke, bootState.dataDir);
    });
    setTimeout(() => {
      writeSmokeResult(smoke.outPath, {
        ok: false,
        error: "Smoke inspection timed out after 20s",
        dataDir: bootState.dataDir,
      });
      app.exit(1);
    }, 20_000).unref();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(bootState.bootError);
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    sliceWorkspace?.close();
  } catch {
    // Closing the business database must not block shutdown.
  }
  sliceWorkspace = null;
});

void boot().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const smoke = parseSmokeOptions(process.argv);
  writeSmokeResult(smoke.outPath, { ok: false, error: message });
  app.exit(1);
});
