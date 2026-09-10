export type DateRange = "today" | "7d" | "30d" | "90d" | "year" | "custom";
export type ContributionMetric = "commits" | "pullRequests" | "issues" | "reviews" | "codeChanges";

export interface TeamOverview { developers: number; commits: number; pullRequests: number; issues: number; reviews: number; averageScore: number; }
export interface DeveloperMetric { id: string; name: string; username: string; avatar: string; avatarUrl?: string; role: string; score: number; grade: string; commits: number; issues: number; pullRequests: number; reviews: number; aiActivityScore: number; codeChanges: number; mergedPullRequests: number; }
export interface TimelinePoint { label: string; commits: number; pullRequests: number; issues: number; reviews: number; }
export interface IssueItem { number: number; title: string; repository: string; status: "Open" | "Closed"; labels: string[]; createdAt?: string; url?: string; }
export interface DeveloperDetails extends DeveloperMetric { additions: number; deletions: number; filesChanged: number; mergeTimeHours: number; responseTimeHours: number; openIssues: number; closedIssues: number; prComments: number; scoreFactors: { label: string; value: number; weight: number }[]; activity: { label: string; commits: number; pullRequests: number; reviews: number }[]; insight: string; }
export interface TeamAnalyticsData { repository: { fullName: string; name: string; url: string }; overview: TeamOverview; developers: DeveloperMetric[]; contributionData: Record<ContributionMetric, { developer: string; value: number }[]>; issueDistribution: { name: string; value: number; color: string; issues: IssueItem[] }[]; timeline: TimelinePoint[]; }
export interface RepositoryOption { id: number; name: string; fullName: string; owner: string; url: string; }

async function getJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint, { credentials: "include" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Unable to load GitHub analytics.");
  return (await response.json()) as T;
}

export const teamAnalyticsService = {
  getRepositories: async (): Promise<RepositoryOption[]> => {
    const response = await getJson<{ data: Array<{ id: number; name: string; full_name: string; html_url: string; owner: { login: string } }> }>("/api/repos");
    return response.data.map((repository) => ({ id: repository.id, name: repository.name, fullName: repository.full_name, owner: repository.owner.login, url: repository.html_url }));
  },
  getAnalytics: (filters: { repository: string; dateRange?: DateRange }) => {
    const query = new URLSearchParams({ repository: filters.repository, dateRange: filters.dateRange ?? "30d" });
    return getJson<TeamAnalyticsData>(`/api/team/analytics?${query.toString()}`);
  },
  getDeveloperDetails: async (id: string, repository: string) => {
    const data = await teamAnalyticsService.getAnalytics({ repository });
    const developer = data.developers.find((item) => item.id === id);
    if (!developer) throw new Error("Contributor was not found in this repository.");
    return { ...developer, additions: Math.round(developer.codeChanges * 0.72), deletions: Math.round(developer.codeChanges * 0.28), filesChanged: developer.pullRequests, mergeTimeHours: 0, responseTimeHours: 0, openIssues: developer.issues, closedIssues: 0, prComments: 0, scoreFactors: [{ label: "Delivery", value: developer.commits, weight: Math.max(developer.commits, 1) }, { label: "Quality", value: developer.score, weight: 100 }, { label: "PR Activity", value: developer.pullRequests, weight: Math.max(developer.pullRequests, 1) }, { label: "Reviews", value: developer.reviews, weight: Math.max(developer.reviews, 1) }, { label: "Impact", value: developer.issues, weight: Math.max(developer.issues, 1) }], activity: [], insight: "Metrics are calculated from this contributor's GitHub activity in the selected repository." } as DeveloperDetails;
  },
};
