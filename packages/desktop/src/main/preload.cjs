"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bookskillDesktop", {
  getShellInfo: () => ipcRenderer.invoke("shell:getInfo"),
  listLibraryBooks: () => ipcRenderer.invoke("library:listBooks"),
  loadLibraryBook: (bookId) => ipcRenderer.invoke("library:loadBook", bookId),
  loadAnnotations: (bookId) => ipcRenderer.invoke("library:loadAnnotations", bookId),
  createExcerpt: (input) => ipcRenderer.invoke("library:createExcerpt", input),
  listKnowledgeCards: () => ipcRenderer.invoke("knowledge:listCards"),
  listKnowledgeBooks: () => ipcRenderer.invoke("knowledge:listBooks"),
  draftKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:draftCard", input),
  updateKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:updateCard", input),
  confirmKnowledgeCard: (input) => ipcRenderer.invoke("knowledge:confirmCard", input),
  mergeKnowledgeCards: (input) => ipcRenderer.invoke("knowledge:mergeCards", input),
  deleteKnowledgeCard: (cardId) => ipcRenderer.invoke("knowledge:deleteCard", cardId),
  listSuggestedRelations: () => ipcRenderer.invoke("relations:listSuggested"),
  listConfirmedRelations: () => ipcRenderer.invoke("relations:listConfirmed"),
  suggestRelation: (input) => ipcRenderer.invoke("relations:suggest", input),
  confirmRelation: (relationId) => ipcRenderer.invoke("relations:confirm", relationId),
  rejectRelation: (relationId) => ipcRenderer.invoke("relations:reject", relationId),
});
