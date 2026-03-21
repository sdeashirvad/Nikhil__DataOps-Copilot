import { AiProvider } from "./aiProvider";

export type OptimizationResult = {
  issues: string[];
  suggestions: string[];
  optimizedQuery: string;
};

export class AiOptimizerService {
  constructor(private readonly aiProvider: AiProvider) {}

  async optimizeQuery(query: string): Promise<OptimizationResult> {
    const prompt = [
      "You are a senior data engineer and SQL optimization expert.",
      "",
      "Analyze the following SQL query:",
      "",
      "1. Identify performance issues",
      "2. Suggest improvements",
      "3. Provide an optimized version of the query",
      "",
      "Focus on:",
      "",
      "- Reducing data scan",
      "- Avoiding SELECT *",
      "- Adding filters",
      "- Using LIMIT when appropriate",
      "- Efficient joins",
      "",
      "Return response in JSON format:",
      "",
      "{",
      '  "issues": ["..."],',
      '  "suggestions": ["..."],',
      '  "optimizedQuery": "..."',
      "}",
      "",
      "Query:",
      query
    ].join("\n");

    const raw = await this.aiProvider.createChatCompletion(
      [
        {
          role: "system",
          content: "You are precise and return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      0.1
    );

    return this.parseOptimizationResponse(raw);
  }

  private parseOptimizationResponse(raw: string): OptimizationResult {
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
      throw new Error("AI optimizer returned invalid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI optimizer returned malformed data.");
    }

    const parsedObj = parsed as Record<string, unknown>;

    const issues = Array.isArray(parsedObj.issues)
      ? parsedObj.issues.filter((item): item is string => typeof item === "string")
      : [];

    const suggestions = Array.isArray(parsedObj.suggestions)
      ? parsedObj.suggestions.filter((item): item is string => typeof item === "string")
      : [];

    const optimizedQuery = parsedObj.optimizedQuery;
    if (typeof optimizedQuery !== "string" || !optimizedQuery.trim()) {
      throw new Error("AI optimizer did not return optimizedQuery.");
    }

    return {
      issues,
      suggestions,
      optimizedQuery: optimizedQuery.trim()
    };
  }
}
