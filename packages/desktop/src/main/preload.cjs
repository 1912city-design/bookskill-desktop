"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bookskillDesktop", {
  getShellInfo: () => ipcRenderer.invoke("shell:getInfo"),
  listLibraryBooks: () => ipcRenderer.invoke("library:listBooks"),
  loadLibraryBook: (bookId) => ipcRenderer.invoke("library:loadBook", bookId),
  loadAnnotations: (bookId) => ipcRenderer.invoke("library:loadAnnotations", bookId),
  createExcerpt: (input) => ipcRenderer.invoke("library:createExcerpt", input),
});
