import { Connection } from "../models/connection";
import { DatabricksApiClient } from "./databricksApiClient";

export type DatabricksCatalogInfo = {
  name: string;
};

export type DatabricksSchemaInfo = {
  catalog: string;
  name: string;
};

export type DatabricksTableInfo = {
  catalog: string;
  schema: string;
  name: string;
  type: string;
};

export class DatabricksMetadataService {
  constructor(private readonly client = new DatabricksApiClient()) {}

  async listCatalogs(connection: Connection): Promise<DatabricksCatalogInfo[]> {
    console.log("Listing catalogs for connection", connection);
    const response = await this.client.get<{ catalogs?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.1/unity-catalog/catalogs"
    );

    return (response.catalogs ?? []).map((catalog) => ({
      name: String(catalog.name ?? "unknown")
    }));
  }

  async listSchemas(connection: Connection, catalog: string): Promise<DatabricksSchemaInfo[]> {
    const response = await this.client.get<{ schemas?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.1/unity-catalog/schemas",
      { catalog_name: catalog }
    );

    return (response.schemas ?? []).map((schema) => ({
      catalog,
      name: String(schema.name ?? "unknown")
    }));
  }

  async listTables(connection: Connection, catalog: string, schema: string): Promise<DatabricksTableInfo[]> {
    const response = await this.client.get<{ tables?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.1/unity-catalog/tables",
      { catalog_name: catalog, schema_name: schema }
    );

    return (response.tables ?? []).map((table) => ({
      catalog,
      schema,
      name: String(table.name ?? "unknown"),
      type: String(table.table_type ?? "TABLE")
    }));
  }
}
