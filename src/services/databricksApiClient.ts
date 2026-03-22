import axios, { AxiosInstance } from "axios";
import { Connection } from "../models/connection";

export class DatabricksApiClient {
  async get<T>(connection: Connection, path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    const client = this.createClient(connection);
    const response = await client.get<T>(path, { params });
    return response.data;
  }

  async post<T>(connection: Connection, path: string, body?: unknown): Promise<T> {
    const client = this.createClient(connection);
    const response = await client.post<T>(path, body);
    return response.data;
  }

  private createClient(connection: Connection): AxiosInstance {
    const token = connection.config.accessToken ?? connection.config.password;
    if (!token) {
      throw new Error("Databricks access token not found. Re-add the connection with a personal access token.");
    }

    const baseURL = this.normalizeHost(connection.config.account);

    return axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
  }

  private normalizeHost(host: string): string {
    const trimmed = host.trim().replace(/\/$/, "");
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  static getDatabricksError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const apiMessage =
        (error.response?.data as { message?: unknown; error_code?: unknown } | undefined)?.message ?? error.message;
      return typeof apiMessage === "string" ? apiMessage : error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
