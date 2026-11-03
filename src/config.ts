import { existsSync, readFileSync } from "fs";
import * as path from "path";

export interface ConfigResult {
  config: Record<string, unknown> | undefined;
  jsConfigPath: string | undefined;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Finds the nearest valid .yaml-fm-lint.json, walking from the document's
 * directory up to the workspace root (inclusive). Never reads or executes
 * .yaml-fm-lint.js; only reports the nearest one seen.
 */
export function findConfig(
  documentPath: string,
  workspaceRoot: string | undefined
): ConfigResult {
  const docDir = path.dirname(documentPath);
  const root =
    workspaceRoot && isInside(workspaceRoot, docDir)
      ? path.resolve(workspaceRoot)
      : docDir;

  let jsConfigPath: string | undefined;
  let dir = path.resolve(docDir);

  for (;;) {
    const jsPath = path.join(dir, ".yaml-fm-lint.js");
    if (!jsConfigPath && existsSync(jsPath)) jsConfigPath = jsPath;

    try {
      const parsed: unknown = JSON.parse(
        readFileSync(path.join(dir, ".yaml-fm-lint.json"), "utf8")
      );
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { config: parsed as Record<string, unknown>, jsConfigPath };
      }
    } catch {
      // missing or invalid JSON: keep walking
    }

    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return { config: undefined, jsConfigPath };
}

export function configForDocument(
  doc: { uri: { scheme: string; fsPath: string } },
  workspaceRoot: string | undefined
): ConfigResult {
  if (doc.uri.scheme !== "file") {
    return { config: undefined, jsConfigPath: undefined };
  }
  return findConfig(doc.uri.fsPath, workspaceRoot);
}
