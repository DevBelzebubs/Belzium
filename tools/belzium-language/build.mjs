import { build, context } from "esbuild";
import { cpSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const watch = process.argv.includes("--watch");

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const typescriptLib = join(dirname(require.resolve("typescript/package.json")), "lib");
const libDir = join(here, "lib");

// La extensión empaqueta typescript, así que sus lib.*.d.ts (lib.dom, lib.esnext,
// etc.) deben vivir junto al bundle: el language service las resuelve desde
// getDefaultLibFileName(). Sin ellas, el checker pierde Array/Object y cualquier
// `items = [1, 2, 3]` se infiere como {}.
cpSync(typescriptLib, libDir, {
  recursive: true,
  filter: (src) => src.endsWith(".d.ts") || statSync(src).isDirectory(),
});

const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  format: "cjs",
  platform: "node",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("esbuild: watching dist/extension.js");
} else {
  await build(options);
}
