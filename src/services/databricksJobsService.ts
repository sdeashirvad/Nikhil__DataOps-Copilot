import { Connection } from "../models/connection";
import { DatabricksApiClient } from "./databricksApiClient";

export type DatabricksRunInfo = {
  runId: string;
  jobId: string;
  state: string;
  startTime: number | null;
  durationMs: number | null;
};

export class DatabricksJobsService {
  constructor(private readonly client = new DatabricksApiClient()) {}

  async listRuns(connection: Connection): Promise<DatabricksRunInfo[]> {
    const response = await this.client.get<{ runs?: Array<Record<string, unknown>> }>(
      connection,
      "/api/2.1/jobs/runs/list",
      { limit: 25 }
    );

    return (response.runs ?? []).map((run) => {
      const state = run.state && typeof run.state === "object" ? (run.state as Record<string, unknown>) : {};
      return {
        runId: String(run.run_id ?? "unknown"),
        jobId: String(run.job_id ?? "unknown"),
        state: String(state.result_state ?? state.life_cycle_state ?? "UNKNOWN"),
        startTime: typeof run.start_time === "number" ? run.start_time : null,
        durationMs: typeof run.run_duration === "number" ? run.run_duration : typeof run.execution_duration === "number" ? run.execution_duration : null
      };
    });
  }
}
