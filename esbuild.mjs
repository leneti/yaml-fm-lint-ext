import * as esbuild from "esbuild";

const production = process.argv.includes("--production");

const result = await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  outfile: "dist/extension.js",
  external: ["vscode"],
  minify: production,
  sourcemap: !production,
  define: {
    "import.meta.url": "__yfl_import_meta_url",
    "import.meta.dirname": "__dirname",
  },
  banner: {
    js: 'const __yfl_import_meta_url = require("url").pathToFileURL(__filename).href;',
  },
  logLevel: "info",
});

if (result.warnings.length > 0) {
  console.error(`esbuild finished with ${result.warnings.length} warning(s)`);
  process.exit(1);
}
