import {
  confirmKnowledgeCard,
  confirmRelation,
  draftKnowledgeCardFromLocator,
  mergeKnowledgeCards,
  openSliceWorkspace,
  rejectRelation,
  suggestRelation,
  updateKnowledgeCard,
  type SliceWorkspace,
} from "@bookskill/core";
import { resolveBusinessDbPath } from "@bookskill/data";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnnotationStore } from "../renderer/read/annotations.ts";
import { listImportedBooks } from "../renderer/read/library.ts";
import { createExcerptFromSelection } from "../renderer/read/locators.ts";
import {
  deleteKnowledgeCardAndKeepBooks,
  enrichKnowledgeCard,
  listKnowledgeBooks,
  listKnowledgeCardViews,
  verifyBookLocatorsRemain,
} from "../renderer/knowledge/catalog.ts";
import { listConfirmedRelationViews, listRelationViews, listSuggestedRelationViews } from "../renderer/relations/catalog.ts";
import { searchDesktopLibrary } from "../renderer/search/run.ts";
import { initializeDataDir } from "../shared/data-layout.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../shared/navigation.ts";
import { PRODUCT_NAME, PRODUCT_VERSION } from "../shared/product.ts";
import type { ShellInfo, SliceSnapshotInfo } from "../shared/shell-info.ts";
import {
  askOnProductPath,
  listConversationSummaries,
  loadConversationView,
  loadLatestConversationView,
  startProductConversation,
} from "./conversation-path.ts";
import { importLibraryBook } from "./library-import.ts";
import {
  createBlankSkill,
  instantiateConceptCard,
  instantiateSkillTemplate,
  listSkillTemplates,
  listSkills,
  loadSkillEditorView,
  parseJsonField,
  parseRulesText,
  saveSkill,
  transitionSkillStatus,
  updateSkillMetadata,
  type SkillStatusAction,
} from "./skills-editor.ts";
import type { SkillInputField, SkillStepField } from "../renderer/skills/types.ts";

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


function readCardEditInput(input: unknown): {
  cardId: string;
  title?: string;
  content?: string;
  conditions?: string | null;
  limitations?: string | null;
} {
  if (!input || typeof input !== "object") {
    throw new Error("缺少知识卡内容。");
  }
  const payload = input as {
    cardId?: unknown;
    title?: unknown;
    content?: unknown;
    conditions?: unknown;
    limitations?: unknown;
  };
  if (typeof payload.cardId !== "string") {
    throw new Error("无效的知识卡编号。");
  }
  return {
    cardId: payload.cardId,
    title: typeof payload.title === "string" ? payload.title : undefined,
    content: typeof payload.content === "string" ? payload.content : undefined,
    conditions: payload.conditions === undefined || payload.conditions === null || typeof payload.conditions === "string"
      ? (payload.conditions as string | null | undefined)
      : undefined,
    limitations: payload.limitations === undefined || payload.limitations === null || typeof payload.limitations === "string"
      ? (payload.limitations as string | null | undefined)
      : undefined,
  };
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

  ipcMain.handle("shell:getInfo", (): ShellInfo => ({
    ...shellInfo,
    businessDbPath: sliceWorkspace?.dbPath ?? bootState.businessDbPath,
    schemaVersion: sliceWorkspace?.schemaVersion ?? bootState.schemaVersion,
    slice: sliceWorkspace?.snapshot() ?? bootState.slice,
    sliceError: sliceWorkspace ? null : bootState.sliceError,
  }));

  ipcMain.handle("library:listBooks", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listImportedBooks(sliceWorkspace.db);
  });

  ipcMain.handle("library:import", (_event, filePath: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!bootState.dataDir) {
      throw new Error("数据目录尚未就绪。");
    }
    const result = importLibraryBook({
      db: sliceWorkspace.db,
      dataDir: bootState.dataDir,
      filePath: typeof filePath === "string" ? filePath : "",
    });
    bootState.slice = sliceWorkspace.snapshot();
    return result.books;
  });

  ipcMain.handle("library:chooseAndImport", async (event) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!bootState.dataDir) {
      throw new Error("数据目录尚未就绪。");
    }
    const window = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
    const options = {
      title: "导入许可的 PDF 或 EPUB",
      properties: ["openFile" as const],
      filters: [
        { name: "许可的 PDF 或 EPUB", extensions: ["pdf", "epub"] },
        { name: "Markdown 或 TXT", extensions: ["md", "markdown", "txt"] },
      ],
    };
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled || !picked.filePaths[0]) {
      return { canceled: true, books: listImportedBooks(sliceWorkspace.db) };
    }
    const result = importLibraryBook({
      db: sliceWorkspace.db,
      dataDir: bootState.dataDir,
      filePath: picked.filePaths[0],
    });
    bootState.slice = sliceWorkspace.snapshot();
    return { canceled: false, books: result.books };
  });

  ipcMain.handle("library:loadBook", (_event, bookId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof bookId !== "string") {
      throw new Error("无效的书籍编号。");
    }
    return sliceWorkspace.loadBook(bookId);
  });

  ipcMain.handle("library:loadAnnotations", (_event, bookId: unknown) => {
    if (!bootState.dataDir) {
      throw new Error("数据目录尚未就绪。");
    }
    if (typeof bookId !== "string") {
      throw new Error("无效的书籍编号。");
    }
    return createAnnotationStore(bootState.dataDir).load(bookId);
  });

  ipcMain.handle("library:createExcerpt", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!bootState.dataDir) {
      throw new Error("数据目录尚未就绪。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少摘录内容。");
    }
    const payload = input as { bookId?: unknown; selectedText?: unknown; note?: unknown };
    if (typeof payload.bookId !== "string") {
      throw new Error("无效的书籍编号。");
    }
    if (typeof payload.selectedText !== "string") {
      throw new Error("选区为空，无法生成摘录。");
    }
    const book = sliceWorkspace.loadBook(payload.bookId);
    const excerpt = createExcerptFromSelection({
      book,
      selectedText: payload.selectedText,
      note: typeof payload.note === "string" ? payload.note : "",
    });
    return createAnnotationStore(bootState.dataDir).save(excerpt);
  });

  ipcMain.handle("knowledge:listCards", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listKnowledgeCardViews(sliceWorkspace.db);
  });

  ipcMain.handle("knowledge:listBooks", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listKnowledgeBooks(sliceWorkspace.db);
  });

  ipcMain.handle("knowledge:draftCard", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少草稿来源。");
    }
    const payload = input as { bookId?: unknown; paragraphId?: unknown };
    if (typeof payload.bookId !== "string" || !payload.bookId.trim()) {
      throw new Error("无效的书籍编号。");
    }
    if (typeof payload.paragraphId !== "string" || !payload.paragraphId.trim()) {
      throw new Error("请填写段落定位符。");
    }
    draftKnowledgeCardFromLocator({
      db: sliceWorkspace.db,
      bookId: payload.bookId,
      paragraphId: payload.paragraphId.trim(),
    });
    return listKnowledgeCardViews(sliceWorkspace.db);
  });

  ipcMain.handle("knowledge:updateCard", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    const payload = readCardEditInput(input);
    updateKnowledgeCard({ db: sliceWorkspace.db, ...payload });
    return listKnowledgeCardViews(sliceWorkspace.db);
  });

  ipcMain.handle("knowledge:confirmCard", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    const payload = readCardEditInput(input);
    confirmKnowledgeCard({ db: sliceWorkspace.db, ...payload });
    return listKnowledgeCardViews(sliceWorkspace.db);
  });

  ipcMain.handle("knowledge:mergeCards", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少要合并的知识卡。");
    }
    const payload = input as { survivingCardId?: unknown; absorbedCardId?: unknown };
    if (typeof payload.survivingCardId !== "string") {
      throw new Error("请选择要保留的知识卡。");
    }
    if (typeof payload.absorbedCardId !== "string") {
      throw new Error("请选择要吸收的知识卡。");
    }
    const absorbed = enrichKnowledgeCard(
      sliceWorkspace.db,
      sliceWorkspace.loadKnowledgeCard(payload.absorbedCardId),
    );
    mergeKnowledgeCards({
      db: sliceWorkspace.db,
      survivingCardId: payload.survivingCardId,
      absorbedCardId: payload.absorbedCardId,
    });
    return {
      cards: listKnowledgeCardViews(sliceWorkspace.db),
      locatorProof: verifyBookLocatorsRemain(sliceWorkspace.db, absorbed.sources),
    };
  });

  ipcMain.handle("knowledge:deleteCard", (_event, cardId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof cardId !== "string") {
      throw new Error("无效的知识卡编号。");
    }
    const result = deleteKnowledgeCardAndKeepBooks(sliceWorkspace.db, cardId);
    return {
      cards: listKnowledgeCardViews(sliceWorkspace.db),
      locatorProof: result.locatorProof,
    };
  });


  ipcMain.handle("search:query", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!bootState.dataDir) {
      throw new Error("数据目录尚未就绪。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少搜索条件。");
    }
    const payload = input as { query?: unknown; mode?: unknown };
    if (typeof payload.query !== "string") {
      throw new Error("请输入搜索关键词。");
    }
    const mode = payload.mode === "semantic" ? "semantic" : payload.mode === "fulltext" || payload.mode === undefined ? "fulltext" : null;
    if (mode == null) {
      throw new Error("无效的搜索模式。");
    }
    return searchDesktopLibrary({
      db: sliceWorkspace.db,
      dataDir: bootState.dataDir,
      query: payload.query,
      mode,
    });
  });

  ipcMain.handle("relations:listSuggested", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listSuggestedRelationViews(sliceWorkspace.db);
  });

  ipcMain.handle("relations:listConfirmed", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listConfirmedRelationViews(sliceWorkspace.db);
  });

  ipcMain.handle("relations:suggest", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少要建议的知识关系。");
    }
    const payload = input as { fromCardId?: unknown; toCardId?: unknown; relationType?: unknown };
    if (typeof payload.fromCardId !== "string" || !payload.fromCardId.trim()) {
      throw new Error("请选择起始知识卡。");
    }
    if (typeof payload.toCardId !== "string" || !payload.toCardId.trim()) {
      throw new Error("请选择目标知识卡。");
    }
    if (typeof payload.relationType !== "string" || !payload.relationType.trim()) {
      throw new Error("请选择关系类型。");
    }
    suggestRelation({
      db: sliceWorkspace.db,
      fromCardId: payload.fromCardId,
      toCardId: payload.toCardId,
      relationType: payload.relationType,
    });
    return listRelationViews(sliceWorkspace.db);
  });

  ipcMain.handle("relations:confirm", (_event, relationId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof relationId !== "string") {
      throw new Error("无效的关系编号。");
    }
    confirmRelation({ db: sliceWorkspace.db, relationId });
    return listRelationViews(sliceWorkspace.db);
  });

  ipcMain.handle("relations:reject", (_event, relationId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof relationId !== "string") {
      throw new Error("无效的关系编号。");
    }
    rejectRelation({ db: sliceWorkspace.db, relationId });
    return listRelationViews(sliceWorkspace.db);
  });

  ipcMain.handle("conversation:start", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    const title =
      input && typeof input === "object" && typeof (input as { title?: unknown }).title === "string"
        ? (input as { title: string }).title
        : undefined;
    const conversation = startProductConversation(sliceWorkspace.db, title);
    bootState.slice = sliceWorkspace.snapshot();
    return conversation;
  });

  ipcMain.handle("conversation:ask", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("请输入要问的问题。");
    }
    const payload = input as { message?: unknown; conversationId?: unknown; title?: unknown };
    if (typeof payload.message !== "string") {
      throw new Error("请输入要问的问题。");
    }
    const conversation = askOnProductPath(sliceWorkspace.db, {
      message: payload.message,
      conversationId: typeof payload.conversationId === "string" ? payload.conversationId : undefined,
      title: typeof payload.title === "string" ? payload.title : undefined,
    });
    bootState.slice = sliceWorkspace.snapshot();
    return conversation;
  });

  ipcMain.handle("conversation:load", (_event, conversationId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof conversationId !== "string" || !conversationId.trim()) {
      const latest = loadLatestConversationView(sliceWorkspace.db);
      if (!latest) {
        throw new Error("还没有可打开的对话。");
      }
      return latest;
    }
    return loadConversationView(sliceWorkspace.db, conversationId);
  });

  ipcMain.handle("conversation:list", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listConversationSummaries(sliceWorkspace.db);
  });


  ipcMain.handle("skills:listTemplates", () => listSkillTemplates());

  ipcMain.handle("skills:list", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    return listSkills(sliceWorkspace.db);
  });

  ipcMain.handle("skills:load", (_event, skillId: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (typeof skillId !== "string" || !skillId.trim()) {
      throw new Error("无效的 Skill 编号。");
    }
    return loadSkillEditorView(sliceWorkspace.db, skillId);
  });

  ipcMain.handle("skills:createBlank", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    const name =
      input && typeof input === "object" && typeof (input as { name?: unknown }).name === "string"
        ? (input as { name: string }).name
        : undefined;
    const status =
      input && typeof input === "object" && typeof (input as { status?: unknown }).status === "string"
        ? (input as { status: string }).status
        : undefined;
    return createBlankSkill(sliceWorkspace.db, { name, status });
  });

  ipcMain.handle("skills:instantiateTemplate", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少要实例化的模板。");
    }
    const payload = input as { templateId?: unknown; name?: unknown; status?: unknown };
    if (typeof payload.templateId !== "string" || !payload.templateId.trim()) {
      throw new Error("请选择一个 Skill 模板。");
    }
    return instantiateSkillTemplate({
      db: sliceWorkspace.db,
      templateId: payload.templateId,
      name: typeof payload.name === "string" ? payload.name : undefined,
      status: typeof payload.status === "string" ? payload.status : undefined,
    });
  });

  ipcMain.handle("skills:updateMetadata", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少要更新的 Skill 元数据。");
    }
    const payload = input as { skillId?: unknown; name?: unknown; domain?: unknown; purpose?: unknown };
    if (typeof payload.skillId !== "string" || !payload.skillId.trim()) {
      throw new Error("无效的 Skill 编号。");
    }
    return updateSkillMetadata(sliceWorkspace.db, {
      skillId: payload.skillId,
      name: typeof payload.name === "string" ? payload.name : undefined,
      domain: typeof payload.domain === "string" ? payload.domain : undefined,
      purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
    });
  });

  ipcMain.handle("skills:save", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少要保存的 Skill 内容。");
    }
    const payload = input as {
      skillId?: unknown;
      name?: unknown;
      domain?: unknown;
      purpose?: unknown;
      whenToUse?: unknown;
      whenNotToUse?: unknown;
      inputs?: unknown;
      steps?: unknown;
      rules?: unknown;
      outputSchema?: unknown;
      permissions?: unknown;
      status?: unknown;
    };
    if (typeof payload.skillId !== "string" || !payload.skillId.trim()) {
      throw new Error("无效的 Skill 编号。");
    }
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      throw new Error("请填写 Skill 名称。");
    }
    if (typeof payload.domain !== "string" || !payload.domain.trim()) {
      throw new Error("请选择 Skill 领域。");
    }
    if (typeof payload.purpose !== "string") {
      throw new Error("请填写 Skill 目的。");
    }
    const permissions = payload.permissions && typeof payload.permissions === "object"
      ? (payload.permissions as { network?: unknown; writeFiles?: unknown; modelProvider?: unknown })
      : {};
    let inputs = payload.inputs;
    let steps = payload.steps;
    let outputSchema = payload.outputSchema;
    let rules = payload.rules;
    if (typeof inputs === "string") {
      inputs = parseJsonField<SkillInputField[]>(inputs, "输入");
    }
    if (typeof steps === "string") {
      steps = parseJsonField<SkillStepField[]>(steps, "步骤");
    }
    if (typeof outputSchema === "string") {
      outputSchema = parseJsonField(outputSchema, "输出 schema");
    }
    if (typeof rules === "string") {
      rules = parseRulesText(rules);
    }
    return saveSkill(sliceWorkspace.db, {
      skillId: payload.skillId,
      name: payload.name,
      domain: payload.domain,
      purpose: payload.purpose,
      whenToUse: typeof payload.whenToUse === "string" ? payload.whenToUse : "",
      whenNotToUse: typeof payload.whenNotToUse === "string" ? payload.whenNotToUse : "",
      inputs: Array.isArray(inputs) ? (inputs as SkillInputField[]) : [],
      steps: Array.isArray(steps) ? (steps as SkillStepField[]) : [],
      rules: Array.isArray(rules) ? (rules as string[]) : [],
      outputSchema: outputSchema ?? {},
      permissions: {
        network: permissions.network === true,
        writeFiles: permissions.writeFiles === true,
        modelProvider: typeof permissions.modelProvider === "string" ? permissions.modelProvider : "local-stub",
      },
      status: typeof payload.status === "string" ? payload.status : undefined,
    });
  });

  ipcMain.handle("skills:transitionStatus", (_event, input: unknown) => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    if (!input || typeof input !== "object") {
      throw new Error("缺少状态转换。");
    }
    const payload = input as { skillId?: unknown; action?: unknown; confirmedByUser?: unknown };
    if (typeof payload.skillId !== "string" || !payload.skillId.trim()) {
      throw new Error("无效的 Skill 编号。");
    }
    if (payload.action !== "mark_tested" && payload.action !== "publish" && payload.action !== "archive") {
      throw new Error("不支持的状态操作。");
    }
    return transitionSkillStatus(sliceWorkspace.db, {
      skillId: payload.skillId,
      action: payload.action as SkillStatusAction,
      confirmedByUser: payload.confirmedByUser === true,
    });
  });

  ipcMain.handle("knowledge:instantiateConceptTemplate", () => {
    if (!sliceWorkspace) {
      throw new Error("业务库尚未打开。");
    }
    instantiateConceptCard(sliceWorkspace.db);
    return listKnowledgeCardViews(sliceWorkspace.db);
  });

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
