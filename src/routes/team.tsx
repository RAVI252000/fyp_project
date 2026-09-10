import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui-bits";
import { teamAnalyticsService, type ContributionMetric, type DateRange, type DeveloperMetric, type RepositoryOption, type TeamAnalyticsData } from "@/lib/team-analytics-service";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/team")({ head: () => ({ meta: [{ title: "Team Analytics · GitInsight AI" }] }), component: Team });
const control = "h-9 rounded-lg border border-border bg-card px-3 text-sm";
const metricLabels: Record<ContributionMetric, string> = { commits: "Commits", pullRequests: "Pull Requests", issues: "Issues", reviews: "Reviews", codeChanges: "Code Changes" };

function Team() {
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [repository, setRepository] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [developer, setDeveloper] = useState("all");
  const [metric, setMetric] = useState<ContributionMetric>("commits");
  const [data, setData] = useState<TeamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRepositories = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await teamAnalyticsService.getRepositories();
      setRepositories(items);
      setRepository((current) => current || items[0]?.fullName || "");
      if (!items.length) setLoading(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load GitHub repositories.");
      setLoading(false);
    }
  };

  useEffect(() => { void loadRepositories(); }, []);
  useEffect(() => {
    if (!repository) return;
    setLoading(true);
    setError("");
    teamAnalyticsService.getAnalytics({ repository, dateRange }).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load GitHub analytics.")).finally(() => setLoading(false));
  }, [repository, dateRange]);

  const contributors = data?.developers.filter((item) => developer === "all" || item.id === developer) ?? [];
  const overview = { developers: contributors.length, commits: contributors.reduce((sum, item) => sum + item.commits, 0), pullRequests: contributors.reduce((sum, item) => sum + item.pullRequests, 0), issues: contributors.reduce((sum, item) => sum + item.issues, 0), reviews: contributors.reduce((sum, item) => sum + item.reviews, 0), averageScore: contributors.length ? Math.round(contributors.reduce((sum, item) => sum + item.score, 0) / contributors.length) : 0 };
  const chartData = contributors.map((item) => ({ developer: item.username, value: item[metric] }));

  return <AppShell><PageHeader title="Team Analytics" subtitle="GitHub contributors, activity, and repository performance." /><div className="flex flex-wrap gap-3 mb-6"><select className={control} value={repository} onChange={(event) => { setRepository(event.target.value); setDeveloper("all"); }} disabled={!repositories.length}><option value="">Select repository</option>{repositories.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select><select className={control} value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} disabled={!repository}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="year">This year</option><option value="custom">Custom</option></select><select className={control} value={developer} onChange={(event) => setDeveloper(event.target.value)} disabled={!data?.developers.length}><option value="all">All contributors</option>{data?.developers.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select></div>{loading ? <LoadingState /> : error ? <Card className="p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-danger" /><p className="mt-3 font-medium">{error}</p><Button className="mt-4" onClick={() => void loadRepositories()}><RefreshCw className="h-4 w-4" /> Retry</Button></Card> : !data?.developers.length ? <Card className="p-10 text-center"><div className="font-semibold">No contributors found</div><p className="text-sm text-muted-foreground mt-1">No GitHub contributors were found for this repository and period.</p></Card> : <><div className="mb-5 text-sm text-muted-foreground">Showing {overview.developers} contributor{overview.developers === 1 ? "" : "s"} from <span className="font-medium text-foreground">{data.repository.fullName}</span></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 mb-6">{[["Contributors", overview.developers], ["Commits", overview.commits], ["Pull Requests", overview.pullRequests], ["Issues", overview.issues], ["Reviews", overview.reviews], ["Average Score", overview.averageScore]].map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold">{value}{label === "Average Score" ? "/100" : ""}</div></Card>)}</div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 mb-6">{contributors.map((item) => <ContributorCard key={item.id} developer={item} repository={data.repository.fullName} />)}</div><Card className="p-6"><div className="flex items-center justify-between mb-4"><div><div className="font-semibold">Contribution comparison</div><div className="text-xs text-muted-foreground">Only contributors from the selected GitHub repository are shown.</div></div><select className={control} value={metric} onChange={(event) => setMetric(event.target.value as ContributionMetric)}>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="h-72"><ResponsiveContainer><BarChart data={chartData}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="developer" /><YAxis /><Tooltip /><Bar dataKey="value" name={metricLabels[metric]} fill="var(--color-brand)" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></>}</AppShell>;
}
function ContributorCard({ developer, repository }: { developer: DeveloperMetric; repository: string }) { return <a href={`/team/developers/${encodeURIComponent(developer.id)}?repository=${encodeURIComponent(repository)}`}><Card className="p-5 h-full"><div className="flex items-center gap-3">{developer.avatarUrl ? <img src={developer.avatarUrl} alt={developer.username} className="h-12 w-12 rounded-full" /> : <div className="h-12 w-12 rounded-full bg-brand-gradient text-white grid place-items-center font-semibold">{developer.avatar}</div>}<div className="min-w-0 flex-1"><div className="font-semibold truncate">{developer.name}</div><div className="text-xs text-muted-foreground">@{developer.username}</div></div><Badge tone="brand">{developer.grade}</Badge></div><div className="mt-4 text-3xl font-semibold">{developer.score}<span className="text-xs text-muted-foreground"> / 100 score</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center">{[["Commits", developer.commits], ["Issues", developer.issues], ["PRs", developer.pullRequests], ["Reviews", developer.reviews]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/60 py-2"><div className="text-sm font-semibold">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>)}</div></Card></a>; }
function LoadingState() { return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-brand" /></div>; }
