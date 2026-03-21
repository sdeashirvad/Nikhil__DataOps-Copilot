import * as vscode from "vscode";
import { QueryHistoryEntry, QueryHistoryService } from "../services/queryHistoryService";

export class HistoryTreeItem extends vscode.TreeItem {
  constructor(readonly entry: QueryHistoryEntry) {
    const truncated = entry.query.replace(/\s+/g, " ").trim();
    super(
      truncated.length > 64 ? truncated.slice(0, 64) + "\u2026" : truncated,
      vscode.TreeItemCollapsibleState.None
    );

    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

    this.description = `${entry.connectionName} \u00b7 ${dateStr} ${timeStr} \u00b7 ${entry.rowCount.toLocaleString()} rows`;
    this.tooltip = new vscode.MarkdownString(
      `**Query**\n\`\`\`sql\n${entry.query}\n\`\`\`\n\n` +
        `**Connection:** ${entry.connectionName}  \n` +
        `**Time:** ${entry.executionTimeMs} ms  \n` +
        `**Rows:** ${entry.rowCount.toLocaleString()}`
    );
    this.iconPath = new vscode.ThemeIcon("history");
    this.command = {
      command: "dataops.openHistoryItem",
      title: "Open in Editor",
      arguments: [this]
    };
    this.contextValue = "dataops.historyItem";
  }
}

export class HistoryTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly queryHistoryService: QueryHistoryService) {
    this.queryHistoryService.onDidChangeHistory(() => this.refresh());
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    const entries = this.queryHistoryService.getEntries();

    if (!entries.length) {
      const empty = new vscode.TreeItem("No query history yet", vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon("info");
      return Promise.resolve([empty]);
    }

    return Promise.resolve(entries.map((e) => new HistoryTreeItem(e)));
  }
}
