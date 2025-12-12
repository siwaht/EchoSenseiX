import { useQuery, useMutation } from "@tanstack/react-query";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Clock, DollarSign, Bot, PhoneCall, AlertCircle, RefreshCw, TrendingUp, Activity, CheckCircle, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserPlanCard } from "@/components/dashboard/user-plan-card";
import { CallAnalyticsCard } from "@/components/dashboard/call-analytics-card";
import { useAgentContext } from "@/contexts/agent-context";
import type { CallLog, Agent } from "@shared/schema";

// Type definitions for dashboard stats
interface DashboardStats {
  totalCalls?: number;
  totalMinutes?: number;
  estimatedCost?: number;
  activeAgents?: number;
  lastSync?: string;
}

// Success Rate Chart Component
const SuccessRateChart = memo(function SuccessRateChart({ selectedAgentId }: { selectedAgentId: string }) {
  const queryParams = selectedAgentId !== "all" ? `?agentId=${selectedAgentId}` : "";

  const { data: callLogs } = useQuery({
    queryKey: ["/api/call-logs", selectedAgentId],
    queryFn: async () => {
      const response = await fetch(`/api/call-logs${queryParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch call logs");
      return response.json();
    },
  });

  // Process call logs for success rate over time
  const processSuccessRate = (logs: CallLog[]) => {
    if (!logs || logs.length === 0) return [];

    const dailyStats: Record<string, { total: number; successful: number }> = {};

    logs.forEach((call) => {
      if (!call.createdAt) return; // Skip calls without createdAt
      const date = new Date(call.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, successful: 0 };
      }
      dailyStats[date].total++;
      if (call.status === 'completed') {
        dailyStats[date].successful++;
      }
    });

    // Convert to array and calculate success rate
    const data = Object.entries(dailyStats)
      .map(([date, stats]: [string, any]) => ({
        date,
        successRate: (stats.successful / stats.total) * 100,
        calls: stats.total
      }))
      .slice(-14); // Last 14 days

    return data;
  };

  const chartData = processSuccessRate(Array.isArray(callLogs) ? callLogs : []);

  return (
    <div className="h-64">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              stroke="#666"
              fontSize={11}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="#666"
              fontSize={11}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="successRate"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorSuccess)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      )}
    </div>
  );
});

// Agent Performance Table Component
const AgentPerformanceTable = memo(function AgentPerformanceTable({ callLogs, agents }: { callLogs: any; agents: any }) {

  // Calculate agent statistics
  const calculateAgentStats = () => {
    if (!callLogs || !agents || !Array.isArray(callLogs) || !Array.isArray(agents)) return [];

    const agentStats: any = {};

    (callLogs as CallLog[]).forEach((call) => {
      const agentId = call.agentId;
      const agent = (agents as Agent[]).find((a) => a.id === agentId);

      // Skip deleted agents - only show stats for currently assigned agents
      if (!agent) return;

      const agentName = agent.name;

      if (!agentStats[agentName]) {
        agentStats[agentName] = {
          name: agentName,
          calls: 0,
          duration: 0,
          llmCost: 0,
          credits: 0
        };
      }

      agentStats[agentName].calls++;
      agentStats[agentName].duration += (call.duration || 0);

      // Fix unrealistic costs - cap at reasonable max of $5 per call
      let cost = Number(call.cost || 0);
      if (cost > 5) {
        // If cost is over $5, assume it's stored incorrectly and divide by 100
        cost = cost / 100;
      }
      agentStats[agentName].llmCost += cost;

      // More realistic credits calculation: 
      // Typically 1 credit = $0.001, so multiply cost by 1000
      agentStats[agentName].credits += Math.round(cost * 1000);
    });

    return Object.values(agentStats)
      .sort((a: any, b: any) => b.calls - a.calls)
      .slice(0, 5); // Top 5 agents
  };

  const agentData = calculateAgentStats();

  return (
    <div className="space-y-2">
      {agentData.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:grid grid-cols-5 gap-3 text-xs text-gray-500 dark:text-gray-400 pb-2 border-b">
            <div className="col-span-1">Agent name</div>
            <div className="text-center">Number of calls</div>
            <div className="text-center">Call minutes</div>
            <div className="text-center">LLM cost</div>
            <div className="text-center">Credits spent</div>
          </div>
          {/* Desktop Rows */}
          <div className="hidden md:block space-y-2">
            {agentData.map((agent: any, index: number) => (
              <div key={index} className="grid grid-cols-5 gap-3 text-sm py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="col-span-1 truncate font-medium">{agent.name}</div>
                <div className="text-center">{agent.calls}</div>
                <div className="text-center">{(agent.duration / 60).toFixed(1)}</div>
                <div className="text-center">${agent.llmCost.toFixed(2)}</div>
                <div className="text-center">{agent.credits.toLocaleString()}</div>
              </div>
            ))}
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {agentData.map((agent: any, index: number) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2">
                <div className="font-medium">{agent.name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Calls:</span>
                    <span className="font-medium">{agent.calls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Minutes:</span>
                    <span className="font-medium">{(agent.duration / 60).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                    <span className="font-medium">${agent.llmCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Credits:</span>
                    <span className="font-medium">{agent.credits.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No agent activity yet
        </div>
      )}
    </div>
  );
});

// Language Stats Component
const LanguageStats = memo(function LanguageStats({ callLogs: _callLogs }: { callLogs: any[] }) {
  // const calculateLanguageStats = () => { ... } - Removed to fix unused variable error

  // Since we don't have language on call logs easily without joining, 
  // and the user wants to remove dummy data, let's just show "No data" if no calls,
  // and if there are calls, we can default to English for now but calculated dynamically
  // or better, let's just remove the hardcoded list.

  // Actually, looking at the code, `LanguageStats` is used in `Dashboard`.
  // I should update `Dashboard` to pass `agents` or `callLogs` to `LanguageStats`.
  // In the current file `LanguageStats` doesn't take props.

  // Let's change it to take `agents` and show the distribution of languages configured in agents.

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground text-center py-2">
        Language analytics coming soon
      </div>
    </div>
  );
});

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { selectedAgent, setSelectedAgent, agents } = useAgentContext();
  const { user } = useAuth();

  // Use agent ID from context
  // When there's only one agent, use its ID instead of "all"
  const selectedAgentId = selectedAgent?.id ||
    (agents.length === 1 && agents[0] ? agents[0].id : "all");

  // Build query parameters based on selected agent
  const queryParams = selectedAgentId !== "all" ? `?agentId=${selectedAgentId}` : "";

  const { data: stats, isLoading, isStale, timeUntilStale } = useOptimizedQuery({
    queryKey: ["/api/analytics/organization", selectedAgentId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/organization${queryParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for dashboard data
    backgroundRefetch: true,
    prefetchThreshold: 30 * 1000, // Prefetch 30 seconds before stale
  });

  const { data: callLogsResponse } = useQuery({
    queryKey: ["/api/call-logs", selectedAgentId],
    queryFn: async () => {
      const response = await fetch(`/api/call-logs${queryParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch call logs");
      return response.json();
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  });

  // Extract data from paginated response
  const callLogs = callLogsResponse?.data || callLogsResponse || [];

  // Fetch pending approvals for current user
  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ["/api/user/pending-approvals"],
  });

  // Real-time sync using WebSocket connection
  const { isConnected, isSyncing, triggerSync } = useRealtimeSync(
    user?.organizationId || '',
    user?.id || ''
  );

  // Fallback sync mutation for when WebSocket is not available
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/dashboard/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Sync failed" }));
        throw new Error(error.message || "Sync failed");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // Display detailed sync results
      const agentStats = data.agents || {};
      const callStats = data.callLogs || {};

      const message = [
        `Agents: ${agentStats.syncedCount || 0} new, ${agentStats.updatedCount || 0} updated`,
        `Calls: ${callStats.syncedCount || 0} new, ${callStats.updatedCount || 0} updated`,
        `Completed in ${data.totalDuration || 0}ms`
      ].join(' | ');

      toast({
        title: "Sync Complete",
        description: message,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
    },
    onError: (error: Error) => {
      console.error("Sync error:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync data from ElevenLabs",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate average duration
  const typedStats = stats as DashboardStats | undefined;
  const avgDuration = typedStats?.totalCalls && typedStats.totalCalls > 0
    ? Math.floor((typedStats.totalMinutes || 0) * 60 / typedStats.totalCalls)
    : 0;
  const avgMinutes = Math.floor(avgDuration / 60);
  const avgSeconds = avgDuration % 60;

  // Calculate average cost per call
  const avgCostPerCall = typedStats?.totalCalls && typedStats.totalCalls > 0
    ? ((typedStats.estimatedCost || 0) / typedStats.totalCalls).toFixed(2)
    : '0.00';

  return (
    <TooltipProvider>
      <div className="space-y-8 p-1">
        {/* Premium background gradient overlay */}
        <div className="fixed inset-0 bg-gradient-to-br from-purple-50/50 via-blue-50/30 to-indigo-50/50 dark:from-purple-950/20 dark:via-blue-950/10 dark:to-indigo-950/20 pointer-events-none -z-10"></div>
        {/* Sync Section */}
        <div className="space-y-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/50 dark:border-purple-800/30 shadow-xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-bold brand-gradient-text">Dashboard</h2>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-muted-foreground break-words">
                {agents.length === 0
                  ? 'No agents available'
                  : selectedAgentId !== "all"
                    ? `Showing: ${Array.isArray(agents) ? agents.find((a) => a.id === selectedAgentId)?.name : 'Agent'} `
                    : typedStats?.lastSync
                      ? `Synced: ${new Date(typedStats?.lastSync || '').toLocaleString()}`
                      : 'Sync to update data'}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Agent Selector - Only show if agents exist */}
            {agents.length > 0 ? (
              <Select
                value={selectedAgentId}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedAgent(null);
                  } else {
                    const agent = agents.find(a => a.id === value);
                    if (agent) setSelectedAgent(agent);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-agent-filter">
                  <Bot className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length > 1 && (
                    <SelectItem value="all">All Agents</SelectItem>
                  )}
                  {Array.isArray(agents) && agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <Bot className="w-4 h-4 flex-shrink-0" />
                <span>No agents assigned - Contact admin for access</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Cache Status Indicator */}
              {isStale && (
                <Badge variant="outline" className="text-xs">
                  Data may be stale
                </Badge>
              )}
              {timeUntilStale > 0 && timeUntilStale < 60000 && (
                <Badge variant="secondary" className="text-xs">
                  Fresh for {Math.round(timeUntilStale / 1000)}s
                </Badge>
              )}

              <Button
                onClick={() => {
                  if (isConnected) {
                    triggerSync();
                  } else {
                    syncMutation.mutate();
                  }
                }}
                disabled={isSyncing || syncMutation.isPending}
                size="sm"
                className="gap-1 sm:gap-2 gradient-purple text-white btn-premium shadow-lg hover:shadow-xl hover:scale-105 transition-all w-full sm:w-auto"
                data-testid="button-sync-data"
              >
                <RefreshCw className={`h-4 w-4 ${(isSyncing || syncMutation.isPending) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {(isSyncing || syncMutation.isPending) ? 'Syncing...' : 'Sync Data'}
                  {isConnected && <span className="ml-1 text-xs opacity-75">(Real-time)</span>}
                </span>
                <span className="sm:hidden">
                  {(isSyncing || syncMutation.isPending) ? 'Syncing' : 'Sync'}
                  {isConnected && <span className="text-xs opacity-75">●</span>}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Pending Approvals Section */}
        {pendingApprovals.length > 0 && (
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800 overflow-hidden">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100">
                    Pending ({pendingApprovals.length})
                  </h3>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs self-start sm:self-auto">
                    Review
                  </Badge>
                </div>
                <div className="space-y-2">
                  {pendingApprovals.slice(0, 3).map((task: any) => (
                    <div key={task.id} className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1 sm:gap-2 mb-1">
                            {task.type === 'approval' && <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0 mt-0.5" />}
                            {task.type === 'review' && <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0 mt-0.5" />}
                            {task.type === 'action' && <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                              {task.title}
                            </h4>
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {task.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {task.relatedEntityType}
                            </span>
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              <span className={`font-medium ${task.priority === 'urgent' ? 'text-red-600' :
                                task.priority === 'high' ? 'text-orange-600' :
                                  task.priority === 'medium' ? 'text-yellow-600' :
                                    'text-green-600'
                                }`}>{task.priority}</span>
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {pendingApprovals.length > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                      +{pendingApprovals.length - 3} more pending approval{pendingApprovals.length - 3 > 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="pt-2 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] sm:text-xs text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950 w-full sm:w-auto"
                      onClick={() => setLocation('/admin')}
                    >
                      <span className="hidden sm:inline">View All in Admin Panel</span>
                      <span className="sm:hidden">View All</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 fade-in">
          {/* Total calls */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border-blue-500/20 dark:border-blue-400/30 backdrop-blur hover:from-blue-500/15 hover:to-blue-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Total Calls</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{typedStats?.totalCalls || 0}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">All conversations</p>
            </div>
          </Card>

          {/* Total duration */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 dark:from-emerald-500/20 dark:to-emerald-600/20 border-emerald-500/20 dark:border-emerald-400/30 backdrop-blur hover:from-emerald-500/15 hover:to-emerald-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Duration</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{typedStats?.totalMinutes || 0}m</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Total time</p>
            </div>
          </Card>

          {/* Total spending */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20 border-amber-500/20 dark:border-amber-400/30 backdrop-blur hover:from-amber-500/15 hover:to-amber-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-amber-500/20 dark:bg-amber-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Spending</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white truncate">${typedStats?.estimatedCost?.toFixed(2) || '0.00'}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Total USD</p>
            </div>
          </Card>

          {/* Average cost per call */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20 border-orange-500/20 dark:border-orange-400/30 backdrop-blur hover:from-orange-500/15 hover:to-orange-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-orange-500/20 dark:bg-orange-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Avg/Call</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">${avgCostPerCall}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Per call</p>
            </div>
          </Card>

          {/* Average duration */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border-purple-500/20 dark:border-purple-400/30 backdrop-blur hover:from-purple-500/15 hover:to-purple-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-purple-500/20 dark:bg-purple-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Avg Time</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{avgMinutes}:{String(avgSeconds).padStart(2, '0')}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Avg length</p>
            </div>
          </Card>

          {/* Active agents */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 dark:from-cyan-500/20 dark:to-cyan-600/20 border-cyan-500/20 dark:border-cyan-400/30 backdrop-blur hover:from-cyan-500/15 hover:to-cyan-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-cyan-500/20 dark:bg-cyan-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Agents</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{typedStats?.activeAgents || 0}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Active</p>
            </div>
          </Card>

          {/* Success rate */}
          <Card className="p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border-green-500/20 dark:border-green-400/30 backdrop-blur hover:from-green-500/15 hover:to-green-600/15 transition-all card-hover group">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-green-500/20 dark:bg-green-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
                  <PhoneCall className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium truncate">Success</p>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
                {(() => {
                  const logs = Array.isArray(callLogs) ? callLogs : [];
                  const completed = logs.filter((l: any) => l.status === 'completed').length;
                  const rate = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 0;
                  return `${rate}%`;
                })()}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Complete</p>
            </div>
          </Card>
        </div>

        {/* User Plan Card */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <UserPlanCard />
          </div>
          <div className="lg:col-span-3">
            {/* Call Volume Line Chart */}
            <Card className="p-4 sm:p-6 dark:bg-slate-800/50 dark:border-slate-700/50 backdrop-blur shadow-xl border-0 h-full bg-white/80 dark:bg-slate-900/80 border-purple-200/30 dark:border-purple-800/20 hover:shadow-2xl transition-all duration-300">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(() => {
                    const logs = Array.isArray(callLogs) ? callLogs : [];
                    const dailyVolume: any = {};
                    const now = new Date();
                    for (let i = 29; i >= 0; i--) {
                      const date = new Date(now);
                      date.setDate(date.getDate() - i);
                      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      dailyVolume[dateKey] = 0;
                    }
                    logs.forEach((call: any) => {
                      const date = new Date(call.createdAt);
                      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      if (dailyVolume.hasOwnProperty(dateKey)) {
                        dailyVolume[dateKey]++;
                      }
                    });
                    return Object.entries(dailyVolume).map(([date, count]) => ({ date, calls: count }));
                  })()} margin={{ top: 5, right: 5, left: 5, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} angle={0} textAnchor="middle" interval={4} tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 'dataMax + 1']} ticks={[0, 1, 2, 3, 4]} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="calls" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 3 }} activeDot={{ r: 5, fill: '#a78bfa', stroke: '#8b5cf6', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* Detailed Call Analytics */}
        <CallAnalyticsCard callLogs={callLogs} stats={stats} />

        {/* Overall Success Rate with Agent Table and Language */}
        <Card className="p-4 sm:p-6 dark:bg-slate-800/50 dark:border-slate-700/50 backdrop-blur">
          <div className="space-y-6">
            {/* Success Rate Chart */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-card-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></div>
                Overall success rate
              </h3>
              <SuccessRateChart selectedAgentId={selectedAgentId} />
            </div>

            {/* Divider */}
            <div className="border-t"></div>

            {/* Most Called Agents and Language Side by Side */}
            <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-card-foreground">Most called agents</h3>
                  <button
                    onClick={() => setLocation('/agents')}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors font-medium"
                  >
                    See all {Array.isArray(agents) ? agents.length : 0} agents
                  </button>
                </div>
                <AgentPerformanceTable callLogs={callLogs} agents={agents} />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-card-foreground">Language</h3>
                <LanguageStats callLogs={callLogs} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}
