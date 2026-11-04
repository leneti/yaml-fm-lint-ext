import * as path from "path";
import Mocha from "mocha";
import { globSync } from "glob";

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 20000,
  });

  const testsRoot = path.resolve(__dirname, "..");

  for (const f of globSync("suite/**/*.test.js", { cwd: testsRoot })) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  const failures = await new Promise<number>((resolve) => mocha.run(resolve));
  if (failures > 0) {
    throw new Error(`${failures} tests failed.`);
  }
}
