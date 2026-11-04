import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["out/**", "dist/**", "**/*.d.ts", "test-fixtures/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      eqeqeq: "warn",
      "no-throw-literal": "warn",
    },
  },
]);
