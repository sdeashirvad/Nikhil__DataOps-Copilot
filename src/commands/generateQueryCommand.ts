import * as vscode from "vscode";
import { TablePreviewRequest } from "../providers/connectionsTreeDataProvider";
import { ConnectionManager } from "../services/connectionManager";
import { SecretStorageService } from "../services/secretStorageService";
import { SnowflakeService } from "../services/snowflakeService";
import { AiQueryGeneratorService } from "../services/aiQueryGeneratorService";
import { getConnectionWithCredentials } from "../utils/connectionCredentials";

export function registerGenerateQueryCommand(
  connectionManager: ConnectionManager,
  secretStorageService: SecretStorageService,
  snowflakeService: SnowflakeService,
  aiQueryGeneratorService: AiQueryGeneratorService
): vscode.Disposable {
  return vscode.commands.registerCommand("dataops.generateQuery", async (input?: unknown) => {
    const request = normalizeTableRequest(input);
    const userInput = await vscode.window.showInputBox({
      prompt: "What do you want to query?",
      placeHolder: "Get top 10 users by revenue last month",
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() ? undefined : "Please provide a query request.")
    });

    if (!userInput) {
      return;
    }

    const activeConnection = request?.connectionId
      ? connectionManager.getConnectionById(request.connectionId)
      : connectionManager.getActiveConnection();

    if (!activeConnection) {
      vscode.window.showErrorMessage("No active connection. Use 'DataOps: Switch Active Connection' first.");
      return;
    }

    if (activeConnection.type !== "snowflake") {
      vscode.window.showWarningMessage("Only Snowflake query generation is currently supported.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating SQL with AI...",
        cancellable: false
      },
      async () => {
        try {
          const connection = await getConnectionWithCredentials(activeConnection, secretStorageService);

          const context = request
            ? { database: request.database, schema: request.schema, table: request.table }
            : await pickTableContext(snowflakeService, connection);

          if (!context) {
            return;
          }

          const columns = await snowflakeService.getTableColumns(
            connection,
            context.database,
            context.schema,
            context.table
          );

          const sql = await aiQueryGeneratorService.generateQuery(userInput, {
            database: context.database,
            schema: context.schema,
            table: context.table,
            columns
          });

          const targetEditor = vscode.window.activeTextEditor;
          if (targetEditor && targetEditor.document.languageId === "sql") {
            await targetEditor.edit((editBuilder) => {
              const selected = targetEditor.selection;
              if (!selected.isEmpty) {
                editBuilder.replace(selected, sql);
              } else {
                editBuilder.insert(targetEditor.selection.active, `${sql}\n`);
              }
            });
            vscode.window.showInformationMessage("Generated SQL inserted into active editor.");
          } else {
            const doc = await vscode.workspace.openTextDocument({ language: "sql", content: sql });
            await vscode.window.showTextDocument(doc, { preview: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Generate SQL failed: ${message}`);
        }
      }
    );
  });
}

function normalizeTableRequest(input: unknown): TablePreviewRequest | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as Record<string, unknown>;
  const payload = (candidate.payload && typeof candidate.payload === "object"
    ? candidate.payload
    : candidate) as Record<string, unknown>;

  const connectionId = payload.connectionId;
  const database = payload.database;
  const schema = payload.schema;
  const table = payload.table;

  if (
    typeof connectionId !== "string" ||
    typeof database !== "string" ||
    typeof schema !== "string" ||
    typeof table !== "string"
  ) {
    return undefined;
  }

  return {
    connectionId,
    database,
    schema,
    table
  };
}

async function pickTableContext(
  snowflakeService: SnowflakeService,
  connection: import("../models/connection").Connection
): Promise<{ database: string; schema: string; table: string } | undefined> {
  const databases = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Fetching tables...", cancellable: false },
    async () => snowflakeService.getDatabases(connection)
  );

  const database = await vscode.window.showQuickPick(databases, {
    placeHolder: "Pick a database for SQL generation"
  });
  if (!database) {
    return undefined;
  }

  const schemas = await snowflakeService.getSchemas(connection, database);
  const schema = await vscode.window.showQuickPick(schemas, {
    placeHolder: `Pick a schema in ${database}`
  });
  if (!schema) {
    return undefined;
  }

  const tables = await snowflakeService.getTables(connection, database, schema);
  const table = await vscode.window.showQuickPick(tables, {
    placeHolder: `Pick a table in ${database}.${schema}`
  });
  if (!table) {
    return undefined;
  }

  return { database, schema, table };
}
