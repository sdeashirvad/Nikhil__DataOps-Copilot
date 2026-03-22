import { Connection } from "../models/connection";
import { DatabricksApiClient } from "./databricksApiClient";

export type DatabricksWarehouseInfo = {
  id: string;
  name: string;
  state: string;
  size: string;
  clusterCount: number | null;
};

export class DatabricksWarehouseService {
  constructor(private readonly client = new DatabricksApiClient()) {}

  async listWarehouses(connection: Connection): Promise<DatabricksWarehouseInfo[]> {
    const response = await this.client.get<{ warehouses?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.0/sql/warehouses"
    );

    return (response.warehouses ?? []).map((warehouse) => ({
      id: String(warehouse.id ?? "unknown"),
      name: String(warehouse.name ?? warehouse.id ?? "Warehouse"),
      state: String(warehouse.state ?? "UNKNOWN"),
      size: String(warehouse.cluster_size ?? warehouse.size ?? "unknown"),
      clusterCount: typeof warehouse.num_clusters === "number" ? warehouse.num_clusters : null
    }));
  }
}
