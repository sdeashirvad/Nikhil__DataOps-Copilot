import * as vscode from "vscode";
import { AiOptimizerService } from "../services/aiOptimizerService";
import { getSqlFromActiveEditor } from "../utils/editor";
import { showOptimizerResultWebview } from "../utils/optimizerWebview";

export function registerOptimizeQueryCommand(aiOptimizerService: AiOptimizerService): vscode.Disposable {
  return vscode.commands.registerCommand("dataops.optimizeQuery", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor. Open a SQL file and try again.");
      return;
    }

    const query = getSqlFromActiveEditor();
    if (!query) {
      vscode.window.showErrorMessage("Query is empty. Select SQL text or add SQL to the current editor.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Optimizing query with AI...",
        cancellable: false
      },
      async () => {
        try {
          const optimization = await aiOptimizerService.optimizeQuery(query);
          showOptimizerResultWebview(editor, optimization);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Query optimization failed: ${message}`);
        }
      }
    );
  });
}
