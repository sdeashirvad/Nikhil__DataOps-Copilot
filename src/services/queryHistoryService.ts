import * as vscode from "vscode";

export type QueryHistoryEntry = {
  id: string;
  query: string;
  timestamp: number;
  connectionName: string;
  rowCount: number;
  executionTimeMs: number;
};

const HISTORY_KEY = "dataops.queryHistory";
const MAX_HISTORY_SIZE = 20;

export class QueryHistoryService {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeHistory = this.onDidChangeEmitter.event;

  constructor(private readonly globalState: vscode.Memento) {}

  getEntries(): QueryHistoryEntry[] {
    return this.globalState.get<QueryHistoryEntry[]>(HISTORY_KEY, []);
  }

  async addEntry(entry: Omit<QueryHistoryEntry, "id">): Promise<void> {
    const entries = this.getEntries();
    const newEntry: QueryHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    };
    const updated = [newEntry, ...entries].slice(0, MAX_HISTORY_SIZE);
    await this.globalState.update(HISTORY_KEY, updated);
    this.onDidChangeEmitter.fire();
  }

  async clearHistory(): Promise<void> {
    await this.globalState.update(HISTORY_KEY, []);
    this.onDidChangeEmitter.fire();
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }
}
