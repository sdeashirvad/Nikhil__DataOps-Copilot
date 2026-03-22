import { Connection } from "../models/connection";
import { QueryExecutionResult } from "../models/query";
import { DatabricksApiClient } from "./databricksApiClient";
import { DatabricksWarehouseService } from "./databricksWarehouseService";

type StatementSubmitResponse = {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: Array<{ name?: string }> } };
  result?: { data_array?: unknown[][] };
};

type StatementGetResponse = StatementSubmitResponse;

export class DatabricksSqlService {
  constructor(
    private readonly client = new DatabricksApiClient(),
    private readonly warehouseService = new DatabricksWarehouseService()
  ) {}

  async executeQuery(connection: Connection, query: string): Promise<QueryExecutionResult> {
    const startedAt = Date.now();
    const warehouseId = await this.resolveWarehouseId(connection);

    const submit = await this.client.post<StatementSubmitResponse>(connection, "/api/2.0/sql/statements", {
      statement: query,
      warehouse_id: warehouseId,
      wait_timeout: "10s",
      disposition: "INLINE"
    });

    const statementId = submit.statement_id;
    if (!statementId) {
      throw new Error(submit.status?.error?.message ?? "Databricks SQL statement submission failed.");
    }

    let finalResponse = submit;
    let state = submit.status?.state ?? "PENDING";

    while (!["SUCCEEDED", "FAILED", "CANCELED"].includes(state)) {
      await delay(600);
      finalResponse = await this.client.get<StatementGetResponse>(
        connection,
        `/api/2.0/sql/statements/${statementId}`
      );
      state = finalResponse.status?.state ?? "PENDING";
    }

    if (state !== "SUCCEEDED") {
      throw new Error(finalResponse.status?.error?.message ?? `Databricks query ended with state ${state}.`);
    }

    const columns = (finalResponse.manifest?.schema?.columns ?? []).map((column, index) => column.name ?? `col_${index + 1}`);
    const dataRows = finalResponse.result?.data_array ?? [];
    const rows = dataRows.map((values) =>
      columns.reduce<Record<string, unknown>>((acc, columnName, index) => {
        acc[columnName] = values[index] ?? null;
        return acc;
      }, {})
    );

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - startedAt,
      raw: finalResponse
    };
  }

  async previewTable(connection: Connection, catalog: string, schema: string, table: string): Promise<QueryExecutionResult> {
    const sql = `SELECT * FROM \`${catalog}\`.\`${schema}\`.\`${table}\` LIMIT 100`;
    return this.executeQuery(connection, sql);
  }

  private async resolveWarehouseId(connection: Connection): Promise<string> {
    if (connection.config.warehouseId?.trim()) {
      return connection.config.warehouseId.trim();
    }

    const warehouses = await this.warehouseService.listWarehouses(connection);
    const running = warehouses.find((warehouse) => warehouse.state.toUpperCase().includes("RUNNING"));
    const fallback = running ?? warehouses[0];

    if (!fallback) {
      throw new Error("No Databricks SQL warehouse found. Add a warehouse ID to the connection.");
    }

    return fallback.id;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
