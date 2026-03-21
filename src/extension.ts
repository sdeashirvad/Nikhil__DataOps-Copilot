import * as vscode from "vscode";
import { registerAddConnectionCommand } from "./commands/addConnectionCommand";
import { registerPreviewTableCommand } from "./commands/previewTableCommand";
import { registerGenerateQueryCommand } from "./commands/generateQueryCommand";
import { registerOptimizeQueryCommand } from "./commands/optimizeQueryCommand";
import { registerPredictQueryCostCommand } from "./commands/predictQueryCostCommand";
import { registerRemoveConnectionCommand } from "./commands/removeConnectionCommand";
import { registerRunQueryCommand } from "./commands/runQueryCommand";
import { registerSwitchConnectionCommand } from "./commands/switchConnectionCommand";
import { registerHistoryCommands } from "./commands/queryHistoryCommand";
import { Connection } from "./models/connection";
import { ConnectionsTreeDataProvider } from "./providers/connectionsTreeDataProvider";
import { HistoryTreeDataProvider } from "./providers/historyTreeProvider";
import { ConnectionManager } from "./services/connectionManager";
import { SecretStorageService } from "./services/secretStorageService";
import { SnowflakeService } from "./services/snowflakeService";
import { QueryHistoryService } from "./services/queryHistoryService";
import { AiProviderFactory } from "./services/aiProvider";
import { AiOptimizerService } from "./services/aiOptimizerService";
import { AiQueryGeneratorService } from "./services/aiQueryGeneratorService";
import { AiCostEstimatorService } from "./services/aiCostEstimatorService";
import { QueryCostAnalyzer } from "./services/queryCostAnalyzer";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const connectionManager = new ConnectionManager();
  const secretStorageService = new SecretStorageService(context.secrets, context.globalState);
  const snowflakeService = new SnowflakeService();
  const queryHistoryService = new QueryHistoryService(context.globalState);
  const queryCostAnalyzer = new QueryCostAnalyzer();

  let aiOptimizerService: AiOptimizerService | undefined;
  let aiQueryGeneratorService: AiQueryGeneratorService | undefined;
  let aiCostEstimatorService: AiCostEstimatorService | undefined;

  try {
    const aiProvider = AiProviderFactory.fromEnvironment();
    aiOptimizerService = new AiOptimizerService(aiProvider);
    aiQueryGeneratorService = new AiQueryGeneratorService(aiProvider);
    aiCostEstimatorService = new AiCostEstimatorService(aiProvider);
  } catch {
    // AI commands will be registered with setup hints when env vars are missing.
  }

  const outputChannel = vscode.window.createOutputChannel("DataOps Copilot");
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "dataops.switchConnection";
  statusBarItem.tooltip = "Switch active DataOps connection";

  const treeProvider = new ConnectionsTreeDataProvider(connectionManager, secretStorageService, snowflakeService);
  const historyProvider = new HistoryTreeDataProvider(queryHistoryService);

  const treeViewDisposable = vscode.window.registerTreeDataProvider("dataops.connectionsView", treeProvider);
  const historyViewDisposable = vscode.window.registerTreeDataProvider("dataops.historyView", historyProvider);

  context.subscriptions.push(outputChannel, statusBarItem, treeViewDisposable, historyViewDisposable, queryHistoryService);

  const refreshUi = () => {
    treeProvider.refresh();

    const active = connectionManager.getActiveConnection();
    const platform =
      active?.type === "snowflake" ? "Snowflake" : active?.type === "databricks" ? "Databricks" : undefined;

    statusBarItem.text = active
      ? `$(pass-filled) ${platform ?? active.type}: ${active.name}`
      : "$(circle-slash) DataOps: No connection";
    statusBarItem.show();
  };

  const persistedConnections = await secretStorageService.getConnectionMetadataList();
  persistedConnections.forEach((connection) => {
    const inMemory: Connection = {
      ...connection,
      config: {
        ...connection.config
      }
    };

    connectionManager.addConnection(inMemory);
  });

  const persistedActiveId = await secretStorageService.getActiveConnectionId();
  if (persistedActiveId) {
    connectionManager.setActiveConnection(persistedActiveId);
  }

  refreshUi();

  connectionManager.onDidChangeConnections(() => {
    refreshUi();
  });

  context.subscriptions.push(
    registerAddConnectionCommand(connectionManager, secretStorageService),
    registerRemoveConnectionCommand(connectionManager, secretStorageService),
    registerSwitchConnectionCommand(connectionManager, secretStorageService),
    registerRunQueryCommand(
      connectionManager,
      secretStorageService,
      snowflakeService,
      outputChannel,
      queryHistoryService,
      queryCostAnalyzer,
      aiCostEstimatorService
    ),
    registerPreviewTableCommand(connectionManager, secretStorageService, snowflakeService, queryHistoryService),
    registerPredictQueryCostCommand(queryCostAnalyzer, aiCostEstimatorService),
    registerOptimizeQueryCommand(
      aiOptimizerService ??
        new AiOptimizerService({
          async createChatCompletion(): Promise<string> {
            throw new Error(
              "AI provider not configured. Set DATAOPS_OPENAI_API_KEY (or DATAOPS_GEMINI_API_KEY + DATAOPS_AI_PROVIDER=gemini)."
            );
          }
        })
    ),
    registerGenerateQueryCommand(
      connectionManager,
      secretStorageService,
      snowflakeService,
      aiQueryGeneratorService ??
        new AiQueryGeneratorService({
          async createChatCompletion(): Promise<string> {
            throw new Error(
              "AI provider not configured. Set DATAOPS_OPENAI_API_KEY (or DATAOPS_GEMINI_API_KEY + DATAOPS_AI_PROVIDER=gemini)."
            );
          }
        })
    ),
    ...registerHistoryCommands(queryHistoryService, connectionManager, secretStorageService, snowflakeService),
    vscode.commands.registerCommand("dataops.refreshConnections", () => {
      refreshUi();
    })
  );
}

export function deactivate(): void {
  // No-op: VS Code disposes subscriptions registered in activate().
}
