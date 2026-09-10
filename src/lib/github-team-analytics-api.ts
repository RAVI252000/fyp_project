import { extractGitHubToken } from "./github-api";

export interface TeamAnalyticsApiData {
  repository: { fullName: string; name: string; url: string };
  overview: { developers: number; commits: number; pullRequests: number; issues: number; reviews: number; averageScore: number };
  developers: Array<{
    id: string; name: string; username: string; avatar: string; avatarUrl: string; role: string;
    score: number; grade: string; commits: number; issues: number; pullRequests: number; reviews: number;
    aiActivityScore: number; codeChanges: number; mergedPullRequests: number;
  }>;
  contributionData: Record<string, { developer: string; value: number }[]>;
  issueDistribution: { name: string; value: number; color: string; issues: unknown[] }[];
  timeline: { label: string; commits: number; pullRequests: number; issues: number; reviews: number }[];
}

type GitHubContributor = { login: string; avatar_url?: string; contributions?: number; html_url?: string };
type GitHubPull = { number: number; user?: { login?: string }; state?: string; merged_at?: string | null; created_at?: string; additions?: number; deletions?: number; changed_files?: number };
type GitHubIssue = { number: number; title: string; user?: { login?: string }; state?: "open" | "closed"; labels?: { name?: string }[]; created_at?: string; html_url?: string; pull_request?: unknown };
type GitHubReview = { user?: { login?: string } };

const colors = ["var(--color-danger)", "var(--color-brand)", "var(--color-warning)", "var(--color-accent-cyan)"];
const categories = ["Bugs", "Features", "Chores", "Documentation"];

function githubUrl(path: string, token: string) {
  return fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "GitInsight-AI", "X-GitHub-Api-Version": "2022-11-28" } });
}

async function githubJson<T>(path: string, token: string): Promise<T> {
  const response = await githubUrl(path, token);
  if (!response.ok) throw new Error(`GitHub API returned ${response.status} for ${path}`);
  return (await response.json()) as T;
}

function initials(login: string) { return login.slice(0, 2).toUpperCase(); }
function grade(score: number) { return score >= 95 ? "A+" : score >= 85 ? "A" : score >= 75 ? "B+" : score >= 65 ? "B" : "C"; }
function category(issue: GitHubIssue) {
  const labels = (issue.labels ?? []).map((label) => label.name?.toLowerCase() ?? "");
  if (labels.some((label) => label.includes("bug") || label.includes("fix"))) return "Bugs";
  if (labels.some((label) => label.includes("feature") || label.includes("enhancement"))) return "Features";
  if (labels.some((label) => label.includes("doc"))) return "Documentation";
  return "Chores";
}
function dateStart(range: string) {
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : range === "year" ? 365 : range === "custom" ? 30 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function handleGetTeamAnalytics(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  const token = extractGitHubToken(request);
  if (!token) return Response.json({ error: "Unauthorized", message: "Connect GitHub to load contributors." }, { status: 401 });
  const url = new URL(request.url);
  const repository = url.searchParams.get("repository") ?? "";
  const range = url.searchParams.get("dateRange") ?? "30d";
  if (!repository || !repository.includes("/")) return Response.json({ error: "A repository in owner/name format is required." }, { status: 400 });
  const [owner, repo] = repository.split("/");
  try {
    const since = dateStart(range);
    const [repoInfo, contributors, pulls, issues] = await Promise.all([
      githubJson<{ full_name: string; name: string; html_url: string }>(`/repos/${owner}/${repo}`, token),
      githubJson<GitHubContributor[]>(`/repos/${owner}/${repo}/contributors?anon=false&per_page=100`, token),
      githubJson<GitHubPull[]>(`/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100`, token),
      githubJson<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=all&since=${encodeURIComponent(since)}&per_page=100`, token),
    ]);
    const contributorLogins = new Set(contributors.map((contributor) => contributor.login));
    const pureIssues = issues.filter((issue) => !issue.pull_request);
    const reviewsByLogin = new Map<string, number>();
    const pullMetrics = await Promise.all(pulls.slice(0, 100).map(async (pull) => {
      const detail = await githubJson<GitHubPull>(`/repos/${owner}/${repo}/pulls/${pull.number}`, token).catch(() => pull);
      const reviews = await githubJson<GitHubReview[]>(`/repos/${owner}/${repo}/pulls/${pull.number}/reviews`, token).catch(() => []);
      for (const review of reviews) {
        const login = review.user?.login;
        if (login && contributorLogins.has(login)) reviewsByLogin.set(login, (reviewsByLogin.get(login) ?? 0) + 1);
      }
      return { pull, detail };
    }));
    const developers = contributors.map((contributor) => {
      const login = contributor.login;
      const pullRequests = pullMetrics.filter(({ pull }) => pull.user?.login === login).length;
      const mergedPullRequests = pullMetrics.filter(({ pull }) => pull.user?.login === login && Boolean(pull.merged_at)).length;
      const userIssues = pureIssues.filter((issue) => issue.user?.login === login).length;
      const reviews = reviewsByLogin.get(login) ?? 0;
      const codeChanges = pullMetrics.filter(({ pull }) => pull.user?.login === login).reduce((total, { detail }) => total + (detail.additions ?? 0) + (detail.deletions ?? 0), 0);
      const commits = contributor.contributions ?? 0;
      const score = Math.min(100, Math.round(Math.min(commits, 100) * 0.35 + Math.min(pullRequests * 5, 25) + Math.min(reviews * 3, 15) + Math.min(userIssues * 2, 10) + (mergedPullRequests ? 15 : 0)));
      return { id: login, name: login, username: login, avatar: initials(login), avatarUrl: contributor.avatar_url ?? "", role: "GitHub Contributor", score, grade: grade(score), commits, issues: userIssues, pullRequests, reviews, aiActivityScore: 0, codeChanges, mergedPullRequests };
    });
    const sum = (key: "commits" | "issues" | "pullRequests" | "reviews") => developers.reduce((total, developer) => total + developer[key], 0);
    const issueDistribution = categories.map((name, index) => ({ name, color: colors[index], issues: pureIssues.filter((issue) => category(issue) === name).map((issue) => ({ number: issue.number, title: issue.title, repository: repoInfo.name, status: issue.state === "open" ? "Open" : "Closed", labels: (issue.labels ?? []).map((label) => label.name), createdAt: issue.created_at, url: issue.html_url })), value: pureIssues.filter((issue) => category(issue) === name).length }));
    const timeline = Array.from({ length: 4 }, (_, index) => ({ label: `${3 - index}M ago`, commits: Math.round(sum("commits") / 4), pullRequests: Math.round(sum("pullRequests") / 4), issues: Math.round(sum("issues") / 4), reviews: Math.round(sum("reviews") / 4) })).reverse();
    const contributionData = Object.fromEntries((["commits", "pullRequests", "issues", "reviews", "codeChanges"] as const).map((key) => [key, developers.map((developer) => ({ developer: developer.name, value: developer[key] }))]));
    const payload: TeamAnalyticsApiData = { repository: { fullName: repoInfo.full_name, name: repoInfo.name, url: repoInfo.html_url }, overview: { developers: developers.length, commits: sum("commits"), pullRequests: sum("pullRequests"), issues: sum("issues"), reviews: sum("reviews"), averageScore: developers.length ? Math.round(developers.reduce((total, developer) => total + developer.score, 0) / developers.length) : 0 }, developers, contributionData, issueDistribution, timeline };
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "GitHub API Error", message: error instanceof Error ? error.message : "Unable to load repository analytics." }, { status: 502 });
  }
}
