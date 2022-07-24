import * as vscode from "vscode";
import { lintFile } from "yaml-fm-lint";
import { readFileSync } from "fs";

const mockArgs = {
  path: "/",
  fix: false,
  config: undefined,
  recursive: false,
  mandatory: true,
  quiet: true,
  oneline: true,
  colored: false,
};

const mockConfig = {
  excludeDirs: [],
  extraExcludeDirs: [],
  extensions: [".md"],
  includeDirs: [],
  mandatory: true,
  requiredAttributes: [],
};

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("yaml-fm-lint");
  context.subscriptions.push(diagnosticCollection);

  let timeout: NodeJS.Timer;
  let activeEditor = vscode.window.activeTextEditor;

  const hoverMsgStart = "YAML-FM-Lint";

  function getDiagnostic(
    err: any,
    msg: string,
    fromLineStart = false,
    severity = vscode.DiagnosticSeverity.Error
  ) {
    const row = err.row - 1;
    const col = err.col - 1;
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(row, fromLineStart ? 0 : col - 1, row, col),
      `${hoverMsgStart}: ${msg}`,
      severity
    );
    diagnostic.source = hoverMsgStart;
    return diagnostic;
  }

  function updateDecorations() {
    if (!activeEditor || activeEditor.document.languageId !== "markdown")
      return;

    const allErrors: vscode.Diagnostic[] = [];
    const allWarnings: vscode.Diagnostic[] = [];

    const filePath = activeEditor.document.fileName.replace(/\\/g, "/");
    const text = activeEditor.document.getText();
    let rootDir = vscode.workspace.workspaceFolders[0].uri.path;
    if (rootDir.startsWith("/")) rootDir = rootDir.substring(1);
    let config = { ...mockConfig };
    try {
      config = {
        ...config,
        ...JSON.parse(readFileSync(`${rootDir}/.yaml-fm-lint.json`, "utf8")),
      };
    } catch (_) {}

    lintFile(filePath, text, mockArgs, config).then(({ errors }: any) => {
      if (errors.noFrontMatter) {
        return console.log("Front matter linting: no front matter");
      }
      console.log("Front matter linting:", errors);

      if (errors.customError) {
        return diagnosticCollection.set(activeEditor.document.uri, [
          getDiagnostic(errors.customError, errors.customError.message, true),
        ]);
      }

      if (errors.missingAttributes.length) {
        allErrors.push(
          new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 3),
            `${hoverMsgStart}: Missing attributes: '${errors.missingAttributes.join(
              "', '"
            )}'`
          )
        );
      }

      if (errors.blankLines.length) {
        errors.blankLines.forEach((line: number) => {
          allErrors.push(
            new vscode.Diagnostic(
              new vscode.Range(line - 1, 0, line - 1, 1),
              `${hoverMsgStart}: There should not be any empty lines in the front matter`
            )
          );
        });
      }

      if (errors.brackets.length) {
        errors.brackets.forEach((err: any) => {
          const msg =
            "There should be no brackets in the front matter.\nTo assign multiple values to a key, use the following syntax:\n\nkey:\n  - value1\n  - value2\n\nNote that the lines with the values must be indented by 2 spaces from the key line.";
          allErrors.push(getDiagnostic(err, msg));
        });
      }

      if (errors.curlyBraces.length) {
        errors.curlyBraces.forEach((err: any) => {
          const msg =
            "There should be no curly braces in the front matter.\n\nTo add properties to an object key, use the following syntax:\n\nkey:\n  prop1: value1\n  prop2: value2\n\nIf you wish to assign multiple objects to a key, use the following syntax:\n\nkey:\n  - prop11: value11\n    prop12: value12\n  - prop21: value21\n    prop22: value22\n\nNote that the lines with the first properties must be indented by 2 spaces from the key line, but the following property lines by 4, as they do not have a dash prefix.";
          allErrors.push(getDiagnostic(err, msg));
        });
      }

      if (errors.indentation.length) {
        errors.indentation.forEach((err: any) => {
          allErrors.push(
            getDiagnostic(
              err,
              `Lines should not be indented more than 2 spaces from the previous line.`,
              true
            )
          );
        });
      }

      if (errors.quotes.length) {
        errors.quotes.forEach((err: any) => {
          allErrors.push(
            getDiagnostic(err, `Quotes should not be used in the front matter.`)
          );
        });
      }

      if (errors.repeatingSpaces.length) {
        errors.repeatingSpaces.forEach((err: any) => {
          const row = err.row - 1;
          const col = err.col - 1;
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(row, col - 2, row, col),
            `${hoverMsgStart}: Possibly unintended whitespace.`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = hoverMsgStart;
          allWarnings.push(diagnostic);
        });
      }

	  if (errors.spacesBeforeColon.length) {
		errors.spacesBeforeColon.forEach((err: any) => {
		  allErrors.push(
            getDiagnostic(err, `There should be no whitespace before colons.`)
          );
		}
	  );
	  }

	  if (errors.trailingCommas.length) {
		errors.trailingCommas.forEach((err: any) => {
		  allErrors.push(
			getDiagnostic(err, `There should be no trailing commas.`)
		  );
		}
	  );
	  }

	  if(errors.trailingSpaces.length) {
		errors.trailingSpaces.forEach((err: any) => {
		  allErrors.push(
			getDiagnostic(err, `There should be no trailing whitespace.`)
		  );
		}
	  );
	  }

	  if (errors.warnCommas.length) {
		errors.warnCommas.forEach((err: any) => {
		  allWarnings.push(
			getDiagnostic(err, `Possibly unintended comma.`, false, vscode.DiagnosticSeverity.Warning)
		  );
		}
	  );
	  }

      diagnosticCollection.set(activeEditor.document.uri, [
        ...allErrors,
        ...allWarnings,
      ]);
    });
  }

  function triggerUpdateDecorations(throttle = false) {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    if (throttle) {
      timeout = setTimeout(updateDecorations, 200);
    } else {
      updateDecorations();
    }
  }

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations(true);
      }
    },
    null,
    context.subscriptions
  );
}
