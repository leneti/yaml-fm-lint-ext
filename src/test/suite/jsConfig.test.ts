import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

function waitFor<T>(
  get: () => T,
  ok: (v: T) => boolean,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = get();
      if (ok(v)) return resolve(v);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("waitFor timed out"));
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

suite("JS config safety", () => {
  test("lints with defaults and never executes .yaml-fm-lint.js", async () => {
    const ws = vscode.workspace.workspaceFolders![0].uri.fsPath;
    fs.rmSync(path.join(ws, "EXECUTED"), { force: true });
    const doc = await vscode.workspace.openTextDocument(path.join(ws, "doc.md"));
    await vscode.window.showTextDocument(doc);
    const diags = await waitFor(
      () => vscode.languages.getDiagnostics(doc.uri),
      (d) => d.length > 0,
      10_000
    );
    assert.ok(diags.some((d) => d.message.includes("there must be no quotes")));
    assert.strictEqual(fs.existsSync(path.join(ws, "EXECUTED")), false);
  });
});
