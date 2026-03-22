import { Connection } from "../models/connection";
import { DatabricksApiClient } from "./databricksApiClient";

export type DatabricksClusterInfo = {
  clusterId: string;
  name: string;
  state: string;
  numWorkers: number | null;
  autoscale?: {
    minWorkers: number;
    maxWorkers: number;
  };
};

export class DatabricksClusterService {
  constructor(private readonly client = new DatabricksApiClient()) {}

  async listClusters(connection: Connection): Promise<DatabricksClusterInfo[]> {
    const response = await this.client.get<{ clusters?: Array<Record<string, unknown>> }>(connection, "/api/2.0/clusters/list");
    return (response.clusters ?? []).map((cluster) => this.mapCluster(cluster));
  }

  async getClusterDetails(connection: Connection, clusterId: string): Promise<DatabricksClusterInfo> {
    const response = await this.client.get<Record<string, unknown>>(connection, "/api/2.0/clusters/get", {
      cluster_id: clusterId
    });
    return this.mapCluster(response);
  }

  private mapCluster(cluster: Record<string, unknown>): DatabricksClusterInfo {
    const autoscale = cluster.autoscale;
    const autoscaleConfig = autoscale && typeof autoscale === "object"
      ? {
          minWorkers: Number((autoscale as Record<string, unknown>).min_workers ?? 0),
          maxWorkers: Number((autoscale as Record<string, unknown>).max_workers ?? 0)
        }
      : undefined;

    return {
      clusterId: String(cluster.cluster_id ?? "unknown"),
      name: String(cluster.cluster_name ?? cluster.cluster_id ?? "Cluster"),
      state: String(cluster.state ?? "UNKNOWN"),
      numWorkers: typeof cluster.num_workers === "number" ? cluster.num_workers : null,
      autoscale: autoscaleConfig
    };
  }
}
