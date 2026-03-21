export type CostLevel = "LOW" | "MEDIUM" | "HIGH";
export type ScanSize = "SMALL" | "MEDIUM" | "LARGE";

export type CostAnalysisResult = {
  estimatedCost: CostLevel;
  scanSize: ScanSize;
  issues: string[];
  suggestions: string[];
};

export class QueryCostAnalyzer {
  analyze(query: string): CostAnalysisResult {
    const normalized = query.replace(/\s+/g, " ").trim();
    const upper = normalized.toUpperCase();

    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    if (/\bSELECT\s+\*/i.test(query)) {
      score += 3;
      issues.push("SELECT * increases scan size and network transfer.");
      suggestions.push("Select only required columns.");
    }

    const isSelectLike = /^\s*(SELECT|WITH)\b/i.test(query);
    if (isSelectLike && !/\bWHERE\b/i.test(query)) {
      score += 3;
      issues.push("Missing WHERE clause can trigger full table scans.");
      suggestions.push("Add selective WHERE filters on partition or indexed columns.");
    }

    if (isSelectLike && !/\bLIMIT\b/i.test(query)) {
      score += 2;
      issues.push("No LIMIT clause detected for a read query.");
      suggestions.push("Add LIMIT for exploration and iterative development.");
    }

    const joinCount = (upper.match(/\bJOIN\b/g) ?? []).length;
    if (joinCount >= 2) {
      score += joinCount >= 4 ? 4 : 2;
      issues.push(`Query contains ${joinCount} JOIN operations.`);
      suggestions.push("Ensure join keys are selective and avoid unnecessary wide joins.");
    }

    if (/\b(COUNT\s*\(\s*DISTINCT|GROUP\s+BY|ORDER\s+BY)\b/i.test(query)) {
      score += 2;
      issues.push("Aggregation/sorting may require larger compute and spill.");
      suggestions.push("Pre-filter rows before GROUP BY or ORDER BY.");
    }

    if (this.hasLargeTableHint(query)) {
      score += 3;
      issues.push("Query appears to reference a table flagged as large.");
      suggestions.push("Filter early and project fewer columns when querying large tables.");
    }

    const estimatedCost: CostLevel = score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
    const scanSize: ScanSize = score >= 7 ? "LARGE" : score >= 4 ? "MEDIUM" : "SMALL";

    if (!issues.length) {
      suggestions.push("Query shape looks efficient for interactive workloads.");
    }

    return {
      estimatedCost,
      scanSize,
      issues,
      suggestions
    };
  }

  private hasLargeTableHint(query: string): boolean {
    const raw = process.env.DATAOPS_LARGE_TABLES?.trim();
    if (!raw) {
      return false;
    }

    const queryUpper = query.toUpperCase();
    const hints = raw
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    return hints.some((tableName) => queryUpper.includes(tableName));
  }
}
