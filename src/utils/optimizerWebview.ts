import * as vscode from "vscode";
import { OptimizationResult } from "../services/aiOptimizerService";

export function showOptimizerResultWebview(
  sourceEditor: vscode.TextEditor,
  optimization: OptimizationResult
): void {
  const panel = vscode.window.createWebviewPanel("dataops.optimizer", "DataOps Query Optimizer", vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: false
  });

  panel.webview.html = renderOptimizationWebview(panel.webview, optimization);

  panel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
    if (message.type !== "replaceQuery") {
      return;
    }

    await sourceEditor.edit((editBuilder) => {
      const selectedText = sourceEditor.document.getText(sourceEditor.selection).trim();

      if (selectedText) {
        editBuilder.replace(sourceEditor.selection, optimization.optimizedQuery);
        return;
      }

      const fullRange = new vscode.Range(
        sourceEditor.document.positionAt(0),
        sourceEditor.document.positionAt(sourceEditor.document.getText().length)
      );
      editBuilder.replace(fullRange, optimization.optimizedQuery);
    });

    vscode.window.showInformationMessage("Query replaced with optimized SQL.");
  });
}

function renderOptimizationWebview(webview: vscode.Webview, optimization: OptimizationResult): string {
  const nonce = getNonce();
  const issues = optimization.issues.length
    ? `<ul>${optimization.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`
    : "<p>No critical issues identified.</p>";

  const suggestions = optimization.suggestions.length
    ? `<ul>${optimization.suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join("")}</ul>`
    : "<p>No additional suggestions.</p>";

  const optimizedSql = escapeHtml(optimization.optimizedQuery);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataOps Query Optimizer</title>
  <style>
    body {
      font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 16px;
    }

    h1 {
      margin: 0 0 14px;
      font-size: 17px;
    }

    .section {
      margin-bottom: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    }

    h2 {
      margin: 0 0 8px;
      font-size: 14px;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
    }

    pre {
      margin: 0;
      overflow: auto;
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border);
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }

    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 7px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h1>SQL Optimization Report</h1>

  <section class="section">
    <h2>⚠ Issues</h2>
    ${issues}
  </section>

  <section class="section">
    <h2>💡 Suggestions</h2>
    ${suggestions}
  </section>

  <section class="section">
    <h2>🚀 Optimized Query</h2>
    <pre><code>${optimizedSql}</code></pre>
    <div class="actions">
      <button id="replace-btn">Replace Query</button>
    </div>
  </section>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    const replaceBtn = document.getElementById("replace-btn");
    if (replaceBtn) {
      replaceBtn.addEventListener("click", () => {
        vscodeApi.postMessage({ type: "replaceQuery" });
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
