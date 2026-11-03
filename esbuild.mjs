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
  logLevel: "info",
});

if (result.warnings.length > 0) {
  console.error(`esbuild finished with ${result.warnings.length} warning(s)`);
  process.exit(1);
}
