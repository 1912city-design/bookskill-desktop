import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL(".", import.meta.url)));

await esbuild.build({
  entryPoints: [path.join(root, "src/main/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["electron"],
  outfile: path.join(root, "dist/main/main.js"),
  sourcemap: true,
  logLevel: "info",
});

await esbuild.build({
  entryPoints: [path.join(root, "src/renderer/main.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  outfile: path.join(root, "dist/renderer/renderer.js"),
  sourcemap: true,
  logLevel: "info",
});

mkdirSync(path.join(root, "dist/main"), { recursive: true });
mkdirSync(path.join(root, "dist/renderer"), { recursive: true });
mkdirSync(path.join(root, "dist/resources"), { recursive: true });
cpSync(path.join(root, "src/main/preload.cjs"), path.join(root, "dist/main/preload.cjs"));
cpSync(path.join(root, "src/renderer/index.html"), path.join(root, "dist/renderer/index.html"));
cpSync(path.join(root, "src/renderer/styles.css"), path.join(root, "dist/renderer/styles.css"));
cpSync(path.join(root, "resources"), path.join(root, "dist/resources"), { recursive: true });

console.log("BookSkill Desktop shell build complete.");
