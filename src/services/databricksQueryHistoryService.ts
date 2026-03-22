import { Connection } from "../models/connection";
import { DatabricksApiClient } from "./databricksApiClient";

export type DatabricksQueryHistoryEntry = {
  queryText: string;
  executionTimeMs: number | null;
  status: string;
  user: string;
};

export class DatabricksQueryHistoryService {
  constructor(private readonly client = new DatabricksApiClient()) {}

  async listQueries(connection: Connection): Promise<DatabricksQueryHistoryEntry[]> {
    const response = await this.client.get<{ res?: Array<Record<string, unknown>>; results?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.0/sql/history/queries"
    );

    const items = response.res ?? response.results ?? [];
    return items.map((query) => ({
      queryText: String(query.query_text ?? query.statement_text ?? ""),
      executionTimeMs: typeof query.duration === "number" ? query.duration : typeof query.execution_time_ms === "number" ? query.execution_time_ms : null,
      status: String(query.status ?? query.state ?? "UNKNOWN"),
      user: String(query.user_name ?? query.user ?? "unknown")
    }));
  }
}
