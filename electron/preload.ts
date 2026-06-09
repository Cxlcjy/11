import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("periodTracker", {
  platform: process.platform
});
