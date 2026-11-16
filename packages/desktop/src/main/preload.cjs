"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

function pathFromFile(file) {
  if (typeof file === "string") {
    return file;
  }
  try {
    if (webUtils && typeof webUtils.getPathForFile === "function" && file) {
      const resolved = webUtils.getPathForFile(file);
      if (resolved) {
        return resolved;
      }
    }
  } catch {
    // Fall through to file.path when the isolated world cannot resolve a File.
  }
  if (file && typeof file.path === "string" && file.path) {
    return file.path;
  }
  return null;
}

contextBridge.exposeInMainWorld("bookskillDesktop", {
  getShellInfo: () => ipcRenderer.invoke("shell:getInfo"),
  listLibraryBooks: () => ipcRenderer.invoke("library:listBooks"),
  loadLibraryBook: (bookId) => ipcRenderer.invoke("library:loadBook", bookId),
  loadAnnotations: (bookId) => ipcRenderer.invoke("library:loadAnnotations", bookId),
  createExcerpt: (input) => ipcRenderer.invoke("library:createExcerpt", input),
  importBook: (filePath) => ipcRenderer.invoke("library:import", filePath),
  importBookFile: (file) => {
    const filePath = pathFromFile(file);
    if (!filePath) {
      return Promise.reject(new Error("无法解析所选文件的路径，请改用「导入许可的 PDF 或 EPUB」。"));
    }
    return ipcRenderer.invoke("library:import", filePath);
  },
  chooseAndImport: () => ipcRenderer.invoke("library:chooseAndImport"),
  listKnowledgeCards: () => ipcRenderer.invoke("knowledge:listCards"),
  listKnowledgeBooks: () => ipcRenderer.invoke("knowledge:listBooks"),
  draftKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:draftCard", input),
  updateKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:updateCard", input),
  confirmKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:confirmCard", input),
  mergeKnowledgeCards: (input) => ipcRenderer.invoke("knowledge:mergeCards", input),
  deleteKnowledgeCard: (cardId) => ipcRenderer.invoke("knowledge:deleteCard", cardId),
  searchLibrary: (input) => ipcRenderer.invoke("search:query", input),
  listSuggestedRelations: () => ipcRenderer.invoke("relations:listSuggested"),
  listConfirmedRelations: () => ipcRenderer.invoke("relations:listConfirmed"),
  suggestRelation: (input) => ipcRenderer.invoke("relations:suggest", input),
  confirmRelation: (relationId) => ipcRenderer.invoke("relations:confirm", relationId),
  rejectRelation: (relationId) => ipcRenderer.invoke("relations:reject", relationId),
  startConversation: (input) => ipcRenderer.invoke("conversation:start", input),
  ask: (input) => ipcRenderer.invoke("conversation:ask", input),
  loadConversation: (conversationId) => ipcRenderer.invoke("conversation:load", conversationId),
  listConversations: () => ipcRenderer.invoke("conversation:list"),
});
