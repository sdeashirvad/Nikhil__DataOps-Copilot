import { AiProvider } from "./aiProvider";
import { CostLevel, ScanSize } from "./queryCostAnalyzer";

export type AiCostEstimate = {
  costLevel: CostLevel;
  scanSize: ScanSize;
  issues: string[];
  suggestions: string[];
};

export class AiCostEstimatorService {
  constructor(private readonly aiProvider: AiProvider) {}

  async estimateQueryCost(query: string): Promise<AiCostEstimate> {
    const prompt = [
      "You are a Snowflake query performance expert.",
      "",
      "Analyze the SQL query below and estimate:",
      "1. Query cost level (LOW, MEDIUM, HIGH)",
      "2. Estimated data scan size (small, medium, large)",
      "3. Performance risks",
      "4. Suggestions to reduce cost",
      "",
      "Consider:",
      "* SELECT *",
      "* Missing filters",
      "* Joins",
      "* Aggregations",
      "* Table size assumptions",
      "",
      "Return JSON:",
      "{",
      '"costLevel": "LOW | MEDIUM | HIGH",',
      '"scanSize": "SMALL | MEDIUM | LARGE",',
      '"issues": [],',
      '"suggestions": []',
      "}",
      "",
      "Query:",
      query
    ].join("\n");

    const raw = await this.aiProvider.createChatCompletion(
      [
        {
          role: "system",
          content: "Return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      0.1
    );

    return this.parse(raw);
  }

  private parse(raw: string): AiCostEstimate {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("AI cost estimator returned invalid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI cost estimator returned malformed data.");
    }

    const obj = parsed as Record<string, unknown>;
    const normalizedCost = String(obj.costLevel ?? "").toUpperCase();
    const normalizedScan = String(obj.scanSize ?? "").toUpperCase();

    const costLevel: CostLevel =
      normalizedCost === "HIGH" ? "HIGH" : normalizedCost === "MEDIUM" ? "MEDIUM" : "LOW";

    const scanSize: ScanSize =
      normalizedScan === "LARGE" ? "LARGE" : normalizedScan === "MEDIUM" ? "MEDIUM" : "SMALL";

    const issues = Array.isArray(obj.issues)
      ? obj.issues.filter((x): x is string => typeof x === "string")
      : [];

    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.filter((x): x is string => typeof x === "string")
      : [];

    return {
      costLevel,
      scanSize,
      issues,
      suggestions
    };
  }
}
