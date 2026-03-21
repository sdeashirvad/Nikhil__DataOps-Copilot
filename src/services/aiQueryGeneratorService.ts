import { AiProvider } from "./aiProvider";

export type QueryGenerationContext = {
  database: string;
  schema: string;
  table: string;
  columns: string[];
};

export class AiQueryGeneratorService {
  constructor(private readonly aiProvider: AiProvider) {}

  async generateQuery(userInput: string, schemaInfo: QueryGenerationContext): Promise<string> {
    const columns = schemaInfo.columns.length ? schemaInfo.columns.join(", ") : "unknown";

    const prompt = [
      "You are a SQL expert.",
      "",
      "Generate a Snowflake-compatible SQL query.",
      "",
      "Context:",
      `- Database: ${schemaInfo.database}`,
      `- Schema: ${schemaInfo.schema}`,
      `- Table: ${schemaInfo.table}`,
      `- Columns: ${columns}`,
      "",
      "User request:",
      userInput,
      "",
      "Rules:",
      "- Use correct SQL syntax",
      "- Use LIMIT when needed",
      "- Avoid SELECT *",
      "- Keep query efficient",
      "",
      "Return ONLY SQL query."
    ].join("\n");

    const response = await this.aiProvider.createChatCompletion(
      [
        {
          role: "system",
          content: "Return only SQL without markdown fences or explanation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      0.2
    );

    return response
      .trim()
      .replace(/^```sql\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  }
}
