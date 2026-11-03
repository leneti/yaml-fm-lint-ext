import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findConfig, configForDocument } from "../../config";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "yfl-"));
}

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

suite("config", () => {
  test("returns the nearest .yaml-fm-lint.json", () => {
    const root = tmp();
    write(path.join(root, ".yaml-fm-lint.json"), '{"requiredAttributes":["a"]}');
    write(path.join(root, "sub", ".yaml-fm-lint.json"), '{"requiredAttributes":["b"]}');
    const res = findConfig(path.join(root, "sub", "doc.md"), root);
    assert.deepStrictEqual(res.config, { requiredAttributes: ["b"] });
  });

  test("does not search above the workspace root", () => {
    const parent = tmp();
    const ws = path.join(parent, "ws");
    write(path.join(parent, ".yaml-fm-lint.json"), '{"mandatory":false}');
    write(path.join(ws, "doc.md"), "");
    assert.strictEqual(findConfig(path.join(ws, "doc.md"), ws).config, undefined);
  });

  test("reports but never executes .yaml-fm-lint.js", () => {
    const ws = tmp();
    const js = path.join(ws, ".yaml-fm-lint.js");
    write(
      js,
      'require("fs").writeFileSync(__dirname + "/EXECUTED", "1"); module.exports = {};'
    );
    const res = findConfig(path.join(ws, "doc.md"), ws);
    assert.strictEqual(res.jsConfigPath, js);
    assert.strictEqual(fs.existsSync(path.join(ws, "EXECUTED")), false);
  });

  test("only checks the document's directory when there is no workspace", () => {
    const root = tmp();
    write(path.join(root, "a", ".yaml-fm-lint.json"), '{"mandatory":false}');
    write(path.join(root, "a", "b", "doc.md"), "");
    assert.strictEqual(
      findConfig(path.join(root, "a", "b", "doc.md"), undefined).config,
      undefined
    );
  });

  test("skips invalid JSON and keeps walking", () => {
    const ws = tmp();
    write(path.join(ws, "sub", ".yaml-fm-lint.json"), "{oops");
    write(path.join(ws, ".yaml-fm-lint.json"), '{"mandatory":false}');
    const res = findConfig(path.join(ws, "sub", "doc.md"), ws);
    assert.deepStrictEqual(res.config, { mandatory: false });
  });

  test("findConfig is not called for non-file documents", () => {
    assert.deepStrictEqual(
      configForDocument({ uri: { scheme: "untitled", fsPath: "Untitled-1" } }, "/ws"),
      { config: undefined, jsConfigPath: undefined }
    );
  });
});
