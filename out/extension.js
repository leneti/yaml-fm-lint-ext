"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const yaml_fm_lint_1 = require("yaml-fm-lint");
const fs_1 = require("fs");
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
    disabledAttributes: [],
    excludeDirs: [],
    extraExcludeDirs: [],
    extensions: [".md"],
    includeDirs: [],
    mandatory: true,
    requiredAttributes: [],
};
const hoverMsgStart = "YAML-FM-Lint";
function getDiagnostic(err, msg, fromLineStart = false, severity = vscode.DiagnosticSeverity.Error) {
    let row, colStart, colEnd;
    if (Array.isArray(err)) {
        row = 0;
        colStart = 0;
        colEnd = 3;
        msg = `${msg}${err[0] ? `: '${err.join("', '")}'` : ""}`;
    }
    else if (typeof err === "number") {
        row = err - 1;
        colStart = 0;
        colEnd = 1;
    }
    else {
        row = err.row - 1;
        colStart = fromLineStart ? 0 : err.colStart !== undefined ? err.colStart : err.col - 2 || 0;
        colEnd = err.colEnd || err.col - 1 || 1;
    }
    const diagnostic = new vscode.Diagnostic(new vscode.Range(row, colStart, row, colEnd), `Front Matter: ${msg}`, severity);
    diagnostic.source = hoverMsgStart;
    return diagnostic;
}
let diagnosticCollection;
function activate(context) {
    diagnosticCollection =
        vscode.languages.createDiagnosticCollection("yaml-fm-lint");
    context.subscriptions.push(diagnosticCollection);
    let timeout;
    let activeEditor = vscode.window.activeTextEditor;
    function updateDecorations() {
        if (!activeEditor || activeEditor.document.languageId !== "markdown")
            return;
        const allErrors = [];
        const allWarnings = [];
        const filePath = activeEditor.document.fileName.replace(/\\/g, "/");
        const text = activeEditor.document.getText();
        let configDir = filePath;
        let config = Object.assign({}, mockConfig);
        while (configDir !== "/") {
            try {
                const configJs = require(`${configDir}.yaml-fm-lint.js`);
                config = Object.assign(Object.assign({}, config), configJs);
                configDir = `${configDir}.yaml-fm-lint.js`;
                break;
            }
            catch (_) {
                try {
                    config = Object.assign(Object.assign({}, config), JSON.parse((0, fs_1.readFileSync)(`${configDir}.yaml-fm-lint.json`, "utf8")));
                    configDir = `${configDir}.yaml-fm-lint.json`;
                    break;
                }
                catch (_) { }
            }
            configDir = configDir.replace(/\/[^\/]*\/?$/, "/");
        }
        console.log("configDir", configDir);
        (0, yaml_fm_lint_1.lintFile)(filePath, text, mockArgs, config).then(({ errors, warnings, }) => {
            if (errors.noFrontMatter) {
                return diagnosticCollection.set(activeEditor.document.uri, [
                    getDiagnostic([""], "no front matter found. Make sure front matter is at the beginning of the file."),
                ]);
            }
            console.log("Front matter errors:", errors);
            console.log("Front matter warnings:", warnings);
            if (errors.customError) {
                return diagnosticCollection.set(activeEditor.document.uri, [
                    getDiagnostic(errors.customError, errors.customError.message, true),
                ]);
            }
            Object.keys(errors).forEach((key) => {
                switch (key) {
                    case "there must be no brackets": {
                        errors[key].forEach((err) => {
                            const msg = "there must be no brackets in the front matter.\nTo assign multiple values to a key, use the following syntax:\n\nkey:\n  - value1\n  - value2\n\nNote that the lines with the values must be indented by 2 spaces from the key line.";
                            allErrors.push(getDiagnostic(err, msg));
                        });
                        break;
                    }
                    case "there must be no curly braces": {
                        errors[key].forEach((err) => {
                            const msg = "there must be no curly braces in the front matter.\n\nTo add properties to an object key, use the following syntax:\n\nkey:\n  prop1: value1\n  prop2: value2\n\nIf you wish to assign multiple objects to a key, use the following syntax:\n\nkey:\n  - prop11: value11\n    prop12: value12\n  - prop21: value21\n    prop22: value22\n\nNote that the lines with the first properties must be indented by 2 spaces from the key line, but the following property lines by 4, as they do not have a dash prefix.";
                            allErrors.push(getDiagnostic(err, msg));
                        });
                        break;
                    }
                    default: {
                        if (typeof errors[key][0] === "string") {
                            allErrors.push(getDiagnostic(errors[key], key));
                        }
                        else {
                            errors[key].forEach((err) => {
                                allErrors.push(getDiagnostic(err, key));
                            });
                        }
                    }
                }
            });
            Object.keys(warnings).forEach((key) => {
                if (typeof warnings[key][0] === "string") {
                    allWarnings.push(getDiagnostic(warnings[key], key, false, vscode.DiagnosticSeverity.Warning));
                }
                else {
                    warnings[key].forEach((err) => {
                        allWarnings.push(getDiagnostic(err, key, false, vscode.DiagnosticSeverity.Warning));
                    });
                }
            });
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
            timeout = setTimeout(updateDecorations, 100);
        }
        else {
            updateDecorations();
        }
    }
    if (activeEditor) {
        triggerUpdateDecorations();
    }
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations(true);
        }
    }, null, context.subscriptions);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map