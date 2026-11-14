import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const packager = createRequire(import.meta.url)("@electron/packager").packager;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const output = await packager({
  dir: root,
  name: "BookSkill Desktop",
  executableName: "bookskill-desktop",
  out: path.join(root, "out"),
  overwrite: true,
  platform: "linux",
  arch: "x64",
  derefSymlinks: true,
  prune: false,
  ignore: [
    /^\/src($|\/)/,
    /^\/test($|\/)/,
    /^\/scripts($|\/)/,
    /^\/out($|\/)/,
    /^\/node_modules($|\/)/,
    /^\/tsconfig\.json$/,
    /docs-smoke-last\.json$/,
  ],
  appVersion: "0.0.0",
  appCopyright: "BookSkill",
  icon: path.join(root, "resources/icon.png"),
});

console.log("Unsigned Linux development directory build written to:");
for (const item of output) {
  console.log(item);
}
console.log("This is not a signed installer and is not a V1 target-OS (Windows 11 / macOS 13+) package.");
