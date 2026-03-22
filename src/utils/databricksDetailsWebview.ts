import * as vscode from "vscode";
import { DatabricksAdvisorResult } from "../services/geminiAdvisorService";

export function showDatabricksDetailsWebview(
  panelTitle: string,
  details: Record<string, string>,
  advisor?: DatabricksAdvisorResult
): void {
  const panel = vscode.window.createWebviewPanel("dataops.databricksDetails", panelTitle, vscode.ViewColumn.Beside, {
    enableFindWidget: true
  });

  panel.webview.html = renderDatabricksDetails(panelTitle, details, advisor);
}

function renderDatabricksDetails(
  panelTitle: string,
  details: Record<string, string>,
  advisor?: DatabricksAdvisorResult
): string {
  const detailRows = Object.entries(details)
    .map(([key, value]) => `<div class="row"><span class="label">${escapeHtml(key)}</span><span class="value">${escapeHtml(value)}</span></div>`)
    .join("");

  const issues = advisor?.issues.length
    ? `<ul>${advisor.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>No major issues detected.</p>";

  const suggestions = advisor?.suggestions.length
    ? `<ul>${advisor.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>No suggestions available.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(panelTitle)}</title>
  <style>
    body {
      font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 16px;
    }
    h1 { margin: 0 0 12px; font-size: 16px; }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    }
    .row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .row:last-child { border-bottom: none; }
    .label { color: var(--vscode-descriptionForeground); }
    .value { font-weight: 600; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
    .recommendation {
      margin-top: 10px;
      padding: 10px;
      border-radius: 6px;
      background: rgba(77, 163, 255, 0.12);
      border: 1px solid rgba(77, 163, 255, 0.3);
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(panelTitle)}</h1>
  <section class="card">
    ${detailRows}
  </section>
  <section class="card">
    <h2>AI Insights</h2>
    <h3>⚠ Issues</h3>
    ${issues}
    <h3>💡 Suggestions</h3>
    ${suggestions}
    ${advisor?.recommendation ? `<div class="recommendation"><strong>Recommendation:</strong> ${escapeHtml(advisor.recommendation)}</div>` : ""}
  </section>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
