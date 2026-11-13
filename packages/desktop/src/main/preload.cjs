"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bookskillDesktop", {
  getShellInfo: () => ipcRenderer.invoke("shell:getInfo"),
});
