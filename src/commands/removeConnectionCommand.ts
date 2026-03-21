import * as vscode from "vscode";
import { ConnectionManager } from "../services/connectionManager";
import { SecretStorageService } from "../services/secretStorageService";
import { ConnectionTreeItem } from "../providers/connectionsTreeDataProvider";

type RemoveConnectionInput = ConnectionTreeItem | { payload?: { connectionId?: string } } | undefined;

export function registerRemoveConnectionCommand(
  connectionManager: ConnectionManager,
  secretStorageService: SecretStorageService
): vscode.Disposable {
  return vscode.commands.registerCommand("dataops.removeConnection", async (input?: RemoveConnectionInput) => {
    const connections = connectionManager.getConnections();
    if (!connections.length) {
      vscode.window.showWarningMessage("No connections available to remove.");
      return;
    }

    const preselectedId = input?.payload?.connectionId;
    let selectedId = preselectedId;
    let selectedName = connections.find((connection) => connection.id === preselectedId)?.name;

    if (!selectedId) {
      const activeId = connectionManager.getActiveConnectionId();
      const picked = await vscode.window.showQuickPick(
        connections.map((connection) => ({
          label: connection.name,
          description: `${connection.type} • ${connection.config.account}`,
          detail: connection.id === activeId ? "Currently active" : undefined,
          id: connection.id
        })),
        { placeHolder: "Select a connection to remove" }
      );

      if (!picked) {
        return;
      }

      selectedId = picked.id;
      selectedName = picked.label;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Remove connection '${selectedName ?? selectedId}'? This deletes saved credentials for this connection.`,
      { modal: true },
      "Remove"
    );

    if (confirm !== "Remove") {
      return;
    }

    await secretStorageService.deleteConnection(selectedId);
    await secretStorageService.deleteConnectionMetadata(selectedId);
    connectionManager.removeConnection(selectedId);
    await secretStorageService.saveActiveConnectionId(connectionManager.getActiveConnectionId());

    void vscode.commands.executeCommand("dataops.refreshConnections");
    vscode.window.showInformationMessage(`Connection removed: ${selectedName ?? selectedId}`);
  });
}
