import { existsSync, readFileSync } from "fs";
import * as path from "path";

export interface ConfigResult {
  config: Record<string, unknown> | undefined;
  jsConfigPath: string | undefined;
}

type PathApi = typeof path.posix;

function isInside(root: string, target: string, p: PathApi = path): boolean {
  const rel = p.relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(".." + p.sep) && !p.isAbsolute(rel))
  );
}

/**
 * Directories to inspect, from docDir upward, ending at root (inclusive).
 * Uses the same containment predicate as the entry check, so it never
 * escapes the workspace on case-insensitive paths.
 */
export function searchDirs(
  docDir: string,
  root: string,
  p: PathApi = path
): string[] {
  const dirs: string[] = [];
  let dir = p.resolve(docDir);
  for (;;) {
    if (!isInside(root, dir, p)) break;
    dirs.push(dir);
    if (p.relative(root, dir) === "") break;
    const parent = p.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
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

  for (const dir of searchDirs(docDir, root)) {
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
