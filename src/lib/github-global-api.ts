import { extractGitHubToken } from "./github-api";

interface GitHubSearchResponse<T> { items: T[]; }
interface SearchRepo { id: number; full_name: string; description?: string | null; html_url: string; }
interface SearchIssue { id: number; number: number; title: string; html_url: string; repository_url?: string; user?: { login?: string }; }
interface SearchUser { id: number; login: string; avatar_url?: string; html_url: string; }

async function githubJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "GitInsight-AI", "X-GitHub-Api-Version": "2022-11-28" } });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return (await response.json()) as T;
}

function unauthorized() { return Response.json({ error: "Unauthorized", message: "Connect GitHub to use search and notifications." }, { status: 401 }); }

export async function handleGetGlobalSearch(request: Request): Promise<Response> {
  const token = extractGitHubToken(request);
  if (!token) return unauthorized();
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return Response.json({ repositories: [], issues: [], users: [] });
  try {
    const encoded = encodeURIComponent(query);
    const [repositories, issues, users] = await Promise.all([
      githubJson<GitHubSearchResponse<SearchRepo>>(`/search/repositories?q=${encoded}&per_page=5`, token),
      githubJson<GitHubSearchResponse<SearchIssue>>(`/search/issues?q=${encoded}&per_page=5`, token),
      githubJson<GitHubSearchResponse<SearchUser>>(`/search/users?q=${encoded}&per_page=5`, token),
    ]);
    return Response.json({ repositories: repositories.items.map((item) => ({ id: item.id, title: item.full_name, description: item.description, url: item.html_url, type: "Repository" })), issues: issues.items.map((item) => ({ id: item.id, title: `#${item.number} ${item.title}`, description: item.user?.login ? `by @${item.user.login}` : "GitHub issue", url: item.html_url, type: "Issue" })), users: users.items.map((item) => ({ id: item.id, title: `@${item.login}`, description: "GitHub contributor", url: item.html_url, avatarUrl: item.avatar_url, type: "Developer" })) });
  } catch (error) { return Response.json({ error: "GitHub API Error", message: error instanceof Error ? error.message : "Search failed." }, { status: 502 }); }
}

export async function handleGetNotifications(request: Request): Promise<Response> {
  const token = extractGitHubToken(request);
  if (!token) return unauthorized();
  try {
    const notifications = await githubJson<Array<{ id: string; subject?: { title?: string }; repository?: { full_name?: string }; updated_at?: string }>>("/notifications?all=false&participating=false&per_page=100", token);
    return Response.json({ count: notifications.length, items: notifications.slice(0, 10).map((item) => ({ id: item.id, title: item.subject?.title ?? "GitHub notification", repository: item.repository?.full_name ?? "", updatedAt: item.updated_at })) });
  } catch (error) { return Response.json({ error: "GitHub API Error", message: error instanceof Error ? error.message : "Notifications failed." }, { status: 502 }); }
}
