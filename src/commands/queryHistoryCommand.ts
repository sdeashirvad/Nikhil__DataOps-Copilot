import * as vscode from "vscode";
import { HistoryTreeItem } from "../providers/historyTreeProvider";
import { QueryHistoryEntry, QueryHistoryService } from "../services/queryHistoryService";
import { ConnectionManager } from "../services/connectionManager";
import { SecretStorageService } from "../services/secretStorageService";
import { SnowflakeService } from "../services/snowflakeService";
import { getConnectionWithCredentials } from "../utils/connectionCredentials";
import { showTableResultWebview, QueryMetrics } from "../utils/webviewTableRenderer";

export function registerHistoryCommands(
  queryHistoryService: QueryHistoryService,
  connectionManager: ConnectionManager,
  secretStorageService: SecretStorageService,
  snowflakeService: SnowflakeService
): vscode.Disposable[] {
  const openCmd = vscode.commands.registerCommand(
    "dataops.openHistoryItem",
    async (item?: HistoryTreeItem | QueryHistoryEntry) => {
      let entry: QueryHistoryEntry | undefined;

      if (item instanceof HistoryTreeItem) {
        entry = item.entry;
      } else if (item && "query" in item) {
        entry = item;
      }

      if (!entry) {
        return;
      }

      const doc = await vscode.workspace.openTextDocument({
        content: entry.query,
        language: "sql"
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    }
  );

  const rerunCmd = vscode.commands.registerCommand(
    "dataops.rerunHistoryItem",
    async (item?: HistoryTreeItem) => {
      const entry = item?.entry;
      if (!entry) {
        return;
      }

      const activeConnection = connectionManager.getActiveConnection();
      if (!activeConnection) {
        vscode.window.showErrorMessage("No active connection. Use 'DataOps: Switch Active Connection' first.");
        return;
      }

      if (activeConnection.type !== "snowflake") {
        vscode.window.showWarningMessage("Only Snowflake query execution is currently supported.");
        return;
      }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Re-running query...", cancellable: false },
        async () => {
          try {
            const conn = await getConnectionWithCredentials(activeConnection, secretStorageService);
            const result = await snowflakeService.executeQuery(conn, entry.query);

            const metrics: QueryMetrics = {
              sql: entry.query,
              rowCount: result.rowCount,
              executionTimeMs: result.executionTimeMs ?? 0
            };

            showTableResultWebview(
              `Query Results - ${activeConnection.name}`,
              result.columns,
              result.rows,
              undefined,
              metrics
            );

            await queryHistoryService.addEntry({
              query: entry.query,
              timestamp: Date.now(),
              connectionName: activeConnection.name,
              rowCount: result.rowCount,
              executionTimeMs: result.executionTimeMs ?? 0
            });

            vscode.window.showInformationMessage(
              `Query completed in ${result.executionTimeMs ?? 0} ms. ${result.rowCount} rows returned.`
            );
          } catch (error) {
            const msg = SnowflakeService.getSnowflakeError(error);
            vscode.window.showErrorMessage(`Query failed: ${msg}`);
          }
        }
      );
    }
  );

  const clearCmd = vscode.commands.registerCommand("dataops.clearHistory", async () => {
    const confirm = await vscode.window.showWarningMessage(
      "Clear all query history? This cannot be undone.",
      { modal: true },
      "Clear"
    );

    if (confirm === "Clear") {
      await queryHistoryService.clearHistory();
      vscode.window.showInformationMessage("Query history cleared.");
    }
  });

  return [openCmd, rerunCmd, clearCmd];
}
