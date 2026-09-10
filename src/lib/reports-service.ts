import type { TeamAnalyticsData } from "./team-analytics-service";

export type ReportType = "Team Performance" | "Repository Health" | "AI Insights" | "Project Summary" | "Developer Performance";
export type ReportStatus = "Ready" | "Generating" | "Failed";

export interface ReportRecord {
  id: string;
  userId: string;
  repositoryId: string;
  reportType: ReportType;
  name: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  status: ReportStatus;
  fileUrl?: string;
  developers: number;
  repositories: number;
}

export interface ReportRequest {
  reportType: ReportType;
  repositoryId: string;
  period: string;
  include: Record<string, boolean>;
}

const initialReports: ReportRecord[] = [
  { id: "report-weekly-28", userId: "demo-user", repositoryId: "all", reportType: "Team Performance", name: "Weekly Team Performance", periodStart: "Sep 1, 2026", periodEnd: "Sep 7, 2026", generatedAt: "Sep 8, 2026", status: "Ready", developers: 6, repositories: 3 },
  { id: "report-health-aug", userId: "demo-user", repositoryId: "all", reportType: "Repository Health", name: "August Repository Health", periodStart: "Aug 1, 2026", periodEnd: "Aug 31, 2026", generatedAt: "Sep 1, 2026", status: "Ready", developers: 6, repositories: 6 },
  { id: "report-ai-aug", userId: "demo-user", repositoryId: "all", reportType: "AI Insights", name: "August AI Insights", periodStart: "Aug 1, 2026", periodEnd: "Aug 31, 2026", generatedAt: "Sep 1, 2026", status: "Ready", developers: 6, repositories: 6 },
];

const storageKey = "gitinsight-reports";
function loadReports(): ReportRecord[] {
  if (typeof window === "undefined") return initialReports;
  try { return JSON.parse(localStorage.getItem(storageKey) || "null") ?? initialReports; } catch { return initialReports; }
}
function saveReports(reports: ReportRecord[]) { if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(reports)); }

async function request<T>(endpoint: string, options: RequestInit, fallback: T): Promise<T> {
  try { const response = await fetch(endpoint, options); if (response.ok) return (await response.json()) as T; } catch { /* fallback */ }
  return fallback;
}

export const reportsService = {
  async list() { return request("/api/reports", {}, loadReports()); },
  async generate(requestData: ReportRequest, analytics: TeamAnalyticsData): Promise<ReportRecord> {
    const now = new Date();
    const fallback: ReportRecord = { id: `report-${now.getTime()}`, userId: "demo-user", repositoryId: requestData.repositoryId, reportType: requestData.reportType, name: `${requestData.reportType} Report`, periodStart: requestData.period === "Last 30 days" ? "Aug 11, 2026" : "Sep 1, 2026", periodEnd: "Sep 10, 2026", generatedAt: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), status: "Ready", developers: analytics.overview.developers, repositories: requestData.repositoryId === "all" ? 6 : 1 };
    const created = await request("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestData) }, fallback);
    const reports = [created, ...loadReports().filter((item) => item.id !== created.id)];
    saveReports(reports);
    return created;
  },
  save: saveReports,
};
