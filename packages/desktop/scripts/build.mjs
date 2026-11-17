import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL(".", import.meta.url)));

await esbuild.build({
  entryPoints: [path.join(root, "src/main/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["electron", "node:sqlite"],
  outfile: path.join(root, "dist/main/main.js"),
  sourcemap: true,
  logLevel: "info",
});

/**
 * The renderer only needs UI helpers and string tokens, but some modules
 * import values from the @bookskill/core barrel. esbuild then resolves
 * Node-only files (parse-pdf, import-book, data-dir) while analyzing that
 * barrel, which fails on platform: "browser". Stub node: builtins so
 * analysis can finish; unused Node modules are tree-shaken out of the
 * IIFE. A post-build check refuses a renderer bundle that still mentions
 * a node: builtin, so a real Node dependency cannot silently ship.
 */
function stubNodeBuiltinsForRenderer() {
  return {
    name: "stub-node-builtins-for-renderer",
    setup(build) {
      build.onResolve({ filter: /^node:/ }, (args) => ({
        path: args.path,
        namespace: "node-stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "node-stub" }, (args) => {
        const builtin = args.path;
        return {
          contents: `
            const unavailable = (..._args) => {
              throw new Error(${JSON.stringify("Node builtin ")} + ${JSON.stringify(builtin)} + ${JSON.stringify(" is not available in the BookSkill Desktop renderer.")});
            };
            const stub = new Proxy(unavailable, { get: () => unavailable });
            export default stub;
            export const inflateSync = unavailable;
            export const inflateRawSync = unavailable;
            export const createHash = unavailable;
            export const randomUUID = unavailable;
            export const DatabaseSync = unavailable;
          `,
          loader: "js",
        };
      });
    },
  };
}

const rendererOutfile = path.join(root, "dist/renderer/renderer.js");
await esbuild.build({
  entryPoints: [path.join(root, "src/renderer/main.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  outfile: rendererOutfile,
  sourcemap: true,
  logLevel: "info",
  plugins: [stubNodeBuiltinsForRenderer()],
});

const rendererSource = readFileSync(rendererOutfile, "utf8");
if (
  rendererSource.includes("node-stub:node:") ||
  /\bnode:(?:fs|path|crypto|os|zlib|sqlite|url)\b/.test(rendererSource)
) {
  throw new Error(
    "Renderer bundle still references a node: builtin. The renderer must not ship Node-only modules; keep Node work in the main process.",
  );
}

mkdirSync(path.join(root, "dist/main"), { recursive: true });
mkdirSync(path.join(root, "dist/renderer"), { recursive: true });
mkdirSync(path.join(root, "dist/resources"), { recursive: true });
cpSync(path.join(root, "src/main/preload.cjs"), path.join(root, "dist/main/preload.cjs"));
cpSync(path.join(root, "src/renderer/index.html"), path.join(root, "dist/renderer/index.html"));
cpSync(path.join(root, "src/renderer/styles.css"), path.join(root, "dist/renderer/styles.css"));
cpSync(path.join(root, "resources"), path.join(root, "dist/resources"), { recursive: true });

console.log("BookSkill Desktop shell build complete.");
