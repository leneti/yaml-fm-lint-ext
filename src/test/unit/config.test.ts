import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findConfig, configForDocument, searchDirs } from "../../config";

const tmpDirs: string[] = [];

function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yfl-"));
  tmpDirs.push(dir);
  return dir;
}

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

suite("config", () => {
  teardown(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

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
    const dir = tmp();
    write(path.join(dir, ".yaml-fm-lint.json"), '{"mandatory":false}');
    assert.deepStrictEqual(
      configForDocument(
        { uri: { scheme: "untitled", fsPath: path.join(dir, "doc.md") } },
        dir
      ),
      { config: undefined, jsConfigPath: undefined }
    );
  });

  test("does not treat a sibling with a common prefix as inside the workspace", () => {
    const parent = tmp();
    const ws = path.join(parent, "ws");
    const sibling = path.join(parent, "ws2");
    write(path.join(parent, ".yaml-fm-lint.json"), '{"mandatory":false}');
    write(path.join(ws, "x.md"), "");
    write(path.join(sibling, "doc.md"), "");
    assert.strictEqual(findConfig(path.join(sibling, "doc.md"), ws).config, undefined);
    write(path.join(sibling, ".yaml-fm-lint.json"), '{"mandatory":true}');
    assert.deepStrictEqual(findConfig(path.join(sibling, "doc.md"), ws).config, {
      mandatory: true,
    });
  });

  test("a sibling named ..foo is not treated as outside via prefix", () => {
    const parent = tmp();
    const ws = path.join(parent, "ws");
    write(path.join(ws, "..foo", ".yaml-fm-lint.json"), '{"mandatory":true}');
    assert.deepStrictEqual(
      findConfig(path.join(ws, "..foo", "doc.md"), ws).config,
      { mandatory: true }
    );
  });

  test("search stops at the workspace root on case-insensitive win32 paths", () => {
    const dirs = searchDirs(
      "c:\\users\\me\\proj\\sub",
      "c:\\Users\\Me\\Proj",
      path.win32
    );
    assert.deepStrictEqual(dirs, ["c:\\users\\me\\proj\\sub", "c:\\users\\me\\proj"]);
  });
});
