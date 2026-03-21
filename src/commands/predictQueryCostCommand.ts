import * as vscode from "vscode";
import { AiCostEstimatorService, AiCostEstimate } from "../services/aiCostEstimatorService";
import { CostAnalysisResult, QueryCostAnalyzer } from "../services/queryCostAnalyzer";
import { getSqlFromActiveEditor } from "../utils/editor";

export type QueryCostPrediction = {
  costLevel: "LOW" | "MEDIUM" | "HIGH";
  scanSize: "SMALL" | "MEDIUM" | "LARGE";
  issues: string[];
  suggestions: string[];
};

export function registerPredictQueryCostCommand(
  queryCostAnalyzer: QueryCostAnalyzer,
  aiCostEstimatorService?: AiCostEstimatorService
): vscode.Disposable {
  return vscode.commands.registerCommand("dataops.predictQueryCost", async () => {
    const sql = getSqlFromActiveEditor();
    if (!sql) {
      vscode.window.showErrorMessage("Query is empty. Select SQL text or add SQL to the current editor.");
      return;
    }

    const prediction = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Predicting query cost...",
        cancellable: false
      },
      async () => predictQueryCost(sql, queryCostAnalyzer, aiCostEstimatorService)
    );
    showCostPredictionPanel(prediction, sql);
  });
}

export async function predictQueryCost(
  sql: string,
  queryCostAnalyzer: QueryCostAnalyzer,
  aiCostEstimatorService?: AiCostEstimatorService
): Promise<QueryCostPrediction> {
  const base = queryCostAnalyzer.analyze(sql);

  if (!aiCostEstimatorService) {
    return fromRule(base);
  }

  try {
    // Keep total latency low; fall back to rule-based result if AI is slow or fails.
    const ai = await Promise.race<AiCostEstimate | null>([
      aiCostEstimatorService.estimateQueryCost(sql),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200))
    ]);

    if (!ai) {
      return fromRule(base);
    }

    return mergeRuleAndAi(base, ai);
  } catch {
    return fromRule(base);
  }
}

function fromRule(base: CostAnalysisResult): QueryCostPrediction {
  return {
    costLevel: base.estimatedCost,
    scanSize: base.scanSize,
    issues: base.issues,
    suggestions: base.suggestions
  };
}

function mergeRuleAndAi(base: CostAnalysisResult, ai: AiCostEstimate): QueryCostPrediction {
  const costRank = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const;
  const scanRank = { SMALL: 1, MEDIUM: 2, LARGE: 3 } as const;

  const costLevel = costRank[ai.costLevel] >= costRank[base.estimatedCost] ? ai.costLevel : base.estimatedCost;
  const scanSize = scanRank[ai.scanSize] >= scanRank[base.scanSize] ? ai.scanSize : base.scanSize;

  const issues = unique([...base.issues, ...ai.issues]);
  const suggestions = unique([...base.suggestions, ...ai.suggestions]);

  return {
    costLevel,
    scanSize,
    issues,
    suggestions
  };
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item.trim());
  }

  return result;
}

function showCostPredictionPanel(prediction: QueryCostPrediction, sql: string): void {
  const panel = vscode.window.createWebviewPanel("dataops.costPrediction", "DataOps Query Cost Prediction", vscode.ViewColumn.Beside, {
    enableFindWidget: true
  });

  panel.webview.html = renderCostWebview(prediction, sql);
}

function renderCostWebview(prediction: QueryCostPrediction, sql: string): string {
  const colorClass = prediction.costLevel === "HIGH" ? "high" : prediction.costLevel === "MEDIUM" ? "medium" : "low";
  const costIcon = prediction.costLevel === "HIGH" ? "🔴" : prediction.costLevel === "MEDIUM" ? "🟡" : "🟢";
  const issuesHtml = prediction.issues.length
    ? `<ul>${prediction.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>No major issues detected.</p>";

  const suggestionsHtml = prediction.suggestions.length
    ? `<ul>${prediction.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>No suggestions available.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Query Cost Prediction</title>
  <style>
    body {
      font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 16px;
    }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    }
    .cost-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 12px;
      margin-left: 8px;
    }
    .low { background: rgba(46, 160, 67, 0.16); color: #2ea043; }
    .medium { background: rgba(251, 188, 5, 0.18); color: #c69500; }
    .high { background: rgba(248, 81, 73, 0.2); color: #f85149; }
    h1 { margin: 0 0 12px; font-size: 16px; }
    h2 { margin: 0 0 8px; font-size: 13px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>Query Cost Predictor</h1>
  <div class="card">
    <div>${costIcon} Cost: <span class="cost-pill ${colorClass}">${prediction.costLevel}</span></div>
    <div style="margin-top: 6px;">📊 Scan Size: <strong>${prediction.scanSize}</strong></div>
  </div>
  <div class="card">
    <h2>⚠ Issues</h2>
    ${issuesHtml}
  </div>
  <div class="card">
    <h2>💡 Suggestions</h2>
    ${suggestionsHtml}
  </div>
  <div class="card">
    <h2>SQL</h2>
    <pre>${escapeHtml(sql)}</pre>
  </div>
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
