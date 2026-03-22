export type DataPlatformType = "snowflake" | "databricks";

export type Connection = {
  id: string;
  name: string;
  type: DataPlatformType;
  config: {
    account: string;
    username: string;
    warehouseId?: string;
    password?: string;
    accessToken?: string;
  };
};

export type StoredConnectionMetadata = Omit<Connection, "config"> & {
  config: {
    account: string;
    username: string;
    warehouseId?: string;
  };
};

export type StoredConnectionSecret = {
  password?: string;
  accessToken?: string;
};
