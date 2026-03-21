import * as vscode from "vscode";

export type QueryMetrics = {
  sql?: string;
  rowCount: number;
  executionTimeMs: number;
  costLevel?: "LOW" | "MEDIUM" | "HIGH";
  scanSize?: "SMALL" | "MEDIUM" | "LARGE";
  costIssues?: string[];
};

type QueryType = "SELECT" | "SHOW" | "INSERT" | "UPDATE" | "DELETE" | "CREATE" | "DROP" | "ALTER" | "OTHER";

function detectQueryType(sql: string): QueryType {
  const upper = sql.trim().toUpperCase();
  const types: QueryType[] = ["SELECT", "SHOW", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER"];
  return types.find((t) => upper.startsWith(t)) ?? "OTHER";
}

function buildWarnings(sql: string): string[] {
  const warnings: string[] = [];
  if (/SELECT\s+\*/i.test(sql)) {
    warnings.push("Avoid <code>SELECT *</code> in production \u2014 specify only the columns you need.");
  }
  if (/^\s*SELECT\b/i.test(sql) && !/\bLIMIT\b/i.test(sql)) {
    warnings.push("No <code>LIMIT</code> clause detected \u2014 large result sets may be slow or costly.");
  }
  return warnings;
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)];
  }
  return nonce;
}

export function renderTableWebview(
  columns: string[],
  rows: Array<Record<string, unknown>>,
  title = "Query Results",
  subtitle?: string,
  metrics?: QueryMetrics
): string {
  const nonce = generateNonce();
  const escapedTitle = escapeHtml(title);
  const hasData = columns.length > 0;

  const queryType = metrics?.sql ? detectQueryType(metrics.sql) : undefined;
  const warnings = metrics?.sql ? buildWarnings(metrics.sql) : [];

  // ── Metrics bar ─────────────────────────────────────────────────────────────
  let metricsHtml = "";
  if (metrics) {
    const badgeClass =
      queryType === "SELECT" ? "badge-select" : queryType === "SHOW" ? "badge-show" : "badge-other";
    const costBadgeClass =
      metrics.costLevel === "HIGH" ? "badge-cost-high" : metrics.costLevel === "MEDIUM" ? "badge-cost-medium" : "badge-cost-low";
    const costLabel = metrics.costLevel ? `Cost ${metrics.costLevel}` : "Cost N/A";
    const scanLabel = metrics.scanSize ? `Scan ${metrics.scanSize}` : "Scan N/A";
    metricsHtml = `
    <div class="metrics-bar">
      <div class="metrics-left">
        ${queryType ? `<span class="type-badge ${badgeClass}">${escapeHtml(queryType)}</span>` : ""}
        <span class="type-badge ${costBadgeClass}">${escapeHtml(costLabel)}</span>
        <span class="type-badge badge-scan">${escapeHtml(scanLabel)}</span>
        <span class="metric"><span class="metric-label">Time</span>${metrics.executionTimeMs.toLocaleString()} ms</span>
        <span class="metric-sep"></span>
        <span class="metric"><span class="metric-label">Rows</span>${metrics.rowCount.toLocaleString()}</span>
      </div>
      ${hasData ? '<button class="btn-csv" onclick="exportCsv()">\u2913 Export CSV</button>' : ""}
    </div>
    ${warnings.map((w) => `<div class="warning-bar">\u26a0\ufe0f ${w}</div>`).join("")}
    ${(metrics.costIssues ?? []).map((w) => `<div class="warning-bar">\u26a0\ufe0f ${escapeHtml(w)}</div>`).join("")}`;
  } else if (subtitle) {
    metricsHtml = `<p class="subtitle">${escapeHtml(subtitle)}</p>`;
  }

  // ── Table HTML ───────────────────────────────────────────────────────────────
  const tableHeader = columns
    .map(
      (col, i) =>
        `<th onclick="sortBy(${i})" data-col="${escapeHtml(col)}" title="Click to sort">${escapeHtml(col)}<span class="sort-icon" id="si-${i}"></span></th>`
    )
    .join("");

  const tableBody = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => `<td onclick="copyCell(this)" title="Click to copy">${escapeHtml(String(row[col] ?? ""))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  // ── Inline JS (single-quoted strings only — no backticks) ────────────────────
  const inlineScript = `
    var sortState = {};

    function sortBy(colIndex) {
      var table = document.getElementById('result-table');
      if (!table) return;
      var tbody = table.tBodies[0];
      var rows = Array.prototype.slice.call(tbody.rows);
      var prev = sortState[colIndex];
      var dir = (prev === 'asc') ? 'desc' : 'asc';
      for (var k in sortState) { if (Object.prototype.hasOwnProperty.call(sortState, k)) delete sortState[k]; }
      sortState[colIndex] = dir;

      rows.sort(function(a, b) {
        var av = a.cells[colIndex] ? a.cells[colIndex].textContent : '';
        var bv = b.cells[colIndex] ? b.cells[colIndex].textContent : '';
        var an = parseFloat(av), bn = parseFloat(bv);
        var isNum = !isNaN(an) && !isNaN(bn) && av.trim() !== '' && bv.trim() !== '';
        if (isNum) return dir === 'asc' ? an - bn : bn - an;
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });

      for (var i = 0; i < rows.length; i++) tbody.appendChild(rows[i]);

      var icons = document.querySelectorAll('.sort-icon');
      for (var j = 0; j < icons.length; j++) {
        icons[j].textContent = (j === colIndex) ? (dir === 'asc' ? ' \\u25b2' : ' \\u25bc') : '';
      }
    }

    function copyCell(td) {
      var text = td.textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          flashCell(td, text);
        }).catch(function() { fallbackCopy(td, text); });
      } else {
        fallbackCopy(td, text);
      }
    }

    function fallbackCopy(td, text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      flashCell(td, text);
    }

    function flashCell(td, text) {
      td.classList.add('copied');
      setTimeout(function() { td.classList.remove('copied'); }, 700);
      var label = text.length > 50 ? text.slice(0, 50) + '\\u2026' : text;
      showToast('Copied: ' + label);
    }

    function showToast(msg) {
      var toast = document.getElementById('copy-toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 2000);
    }

    function exportCsv() {
      var table = document.getElementById('result-table');
      if (!table) return;
      var ths = table.querySelectorAll('thead th');
      var headers = Array.prototype.map.call(ths, function(th) {
        return '"' + (th.getAttribute('data-col') || '').replace(/"/g, '""') + '"';
      });
      var trs = table.querySelectorAll('tbody tr');
      var dataRows = Array.prototype.map.call(trs, function(tr) {
        return Array.prototype.map.call(tr.querySelectorAll('td'), function(td) {
          return '"' + (td.textContent || '').replace(/"/g, '""') + '"';
        }).join(',');
      });
      var csv = headers.join(',') + '\\n' + dataRows.join('\\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'query-results.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, "Segoe UI", system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 14px 16px 12px;
      gap: 8px;
    }

    h1 {
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .subtitle {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }

    /* ── Metrics bar ──────────────────────────── */
    .metrics-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px 12px;
      flex-shrink: 0;
    }

    .metrics-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .type-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .badge-select { background: rgba(14, 108, 196, 0.20); color: #4da3ff; border: 1px solid rgba(14, 108, 196, 0.40); }
    .badge-show   { background: rgba(124, 77, 255, 0.20); color: #b388ff; border: 1px solid rgba(124, 77, 255, 0.40); }
    .badge-other  { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border: 1px solid transparent; }
    .badge-cost-low { background: rgba(46, 160, 67, 0.18); color: #2ea043; border: 1px solid rgba(46, 160, 67, 0.42); }
    .badge-cost-medium { background: rgba(251, 188, 5, 0.20); color: #c69500; border: 1px solid rgba(251, 188, 5, 0.45); }
    .badge-cost-high { background: rgba(248, 81, 73, 0.22); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.45); }
    .badge-scan { background: rgba(128, 128, 128, 0.20); color: var(--vscode-editor-foreground); border: 1px solid rgba(128, 128, 128, 0.35); }

    .metric {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
    }

    .metric-label {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .metric-sep {
      width: 1px;
      height: 14px;
      background: var(--vscode-panel-border);
    }

    .btn-csv {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-button-secondaryBackground, transparent);
      color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-csv:hover { opacity: 0.82; }
    .btn-csv:active { opacity: 0.65; }

    /* ── Warning bars ────────────────────────── */
    .warning-bar {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      background: rgba(245, 166, 35, 0.08);
      border: 1px solid rgba(245, 166, 35, 0.35);
      color: var(--vscode-editorWarning-foreground, #f0a500);
      flex-shrink: 0;
    }
    .warning-bar code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      background: rgba(245, 166, 35, 0.18);
      padding: 0 3px;
      border-radius: 3px;
    }

    /* ── Table ───────────────────────────────── */
    .table-wrap {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: auto;
      flex: 1;
      min-height: 0;
    }

    table {
      border-collapse: collapse;
      width: max-content;
      min-width: 100%;
      font-size: 12px;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      color: var(--vscode-editor-foreground);
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid var(--vscode-panel-border);
      border-right: 1px solid var(--vscode-panel-border);
      padding: 7px 10px;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    thead th:last-child { border-right: none; }
    thead th:hover { background: var(--vscode-list-hoverBackground); }

    .sort-icon { margin-left: 3px; font-size: 9px; opacity: 0.65; }

    td {
      padding: 5px 10px;
      white-space: nowrap;
      border-right: 1px solid var(--vscode-panel-border);
      border-bottom: 1px solid var(--vscode-panel-border);
      vertical-align: top;
      cursor: pointer;
      max-width: 360px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    td:last-child { border-right: none; }

    tbody tr:nth-child(even) { background: rgba(128, 128, 128, 0.06); }
    tbody tr:hover { background: var(--vscode-list-hoverBackground) !important; }
    td.copied { background: rgba(117, 190, 255, 0.22) !important; transition: background 0.1s; }

    .empty-msg {
      padding: 32px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }

    /* ── Copy toast ──────────────────────────── */
    #copy-toast {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: var(--vscode-editor-foreground);
      color: var(--vscode-editor-background);
      padding: 6px 14px;
      border-radius: 5px;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
      z-index: 10;
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #copy-toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapedTitle}</h1>
    ${metricsHtml}
    <div class="table-wrap">
      ${
        !hasData
          ? `<div class="empty-msg">No tabular result returned.</div>`
          : `<table id="result-table">
               <thead><tr>${tableHeader}</tr></thead>
               <tbody>${tableBody}</tbody>
             </table>`
      }
    </div>
  </div>
  <div id="copy-toast"></div>
  <script nonce="${nonce}">${inlineScript}</script>
</body>
</html>`;
}

export function showTableResultWebview(
  panelTitle: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
  subtitle?: string,
  metrics?: QueryMetrics
): void {
  const panel = vscode.window.createWebviewPanel("dataops.results", panelTitle, vscode.ViewColumn.Beside, {
    enableScripts: true,
    enableFindWidget: true,
    retainContextWhenHidden: false
  });

  panel.webview.html = renderTableWebview(columns, rows, panelTitle, subtitle, metrics);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
