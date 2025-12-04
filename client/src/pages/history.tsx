import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, RefreshCw, Play, Pause, Download, Filter } from "lucide-react";
import { CallDetailModal } from "@/components/modals/call-detail-modal";
import { TranscriptSearch } from "@/components/call-history/transcript-search";
import { AnalyticsExport } from "@/components/analytics/analytics-export";
import type { CallLog } from "@shared/schema";
import { useAgentContext } from "@/contexts/agent-context";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

export default function History() {
  const { selectedAgent, setSelectedAgent, agents } = useAgentContext();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<CallLog[] | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enhanced audio player
  const {
    isPlaying,
    currentTrackId,
    isLoading: audioLoading,
    queueAudio,
    togglePlayPause
  } = useAudioPlayer();

  const { data: callLogsResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/call-logs"],
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract data from paginated response
  const callLogs = callLogsResponse?.data || callLogsResponse || [];

  // Agents are now provided by context

  const syncCallsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sync-calls"),
    onSuccess: (data: any) => {
      const syncResults = data.syncResults || {};
      const message = `Sync completed: ${data.syncedCount || 0} new, ${data.updatedCount || 0} updated call logs`;

      toast({
        title: "Sync Complete",
        description: message,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });

      // Show detailed sync results if available
      if (syncResults.conversations?.errors > 0 || syncResults.agents?.errors > 0) {
        toast({
          title: "Sync Completed with Warnings",
          description: `${syncResults.conversations?.errors || 0} conversation errors, ${syncResults.agents?.errors || 0} agent errors`,
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync call logs from voice service",
        variant: "destructive",
      });
    },
  });

  const generateSummariesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobs/generate-all-summaries"),
    onSuccess: (data: any) => {
      const message = `Generated ${data.successful || 0} summaries (${data.failed || 0} failed)`;
      toast({
        title: "Summaries Generated",
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Summary Generation Failed",
        description: error.message || "Failed to generate summaries",
        variant: "destructive",
      });
    },
  });

  const fetchAudioMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobs/fetch-missing-audio"),
    onSuccess: (data: any) => {
      const message = `Fetched ${data.successful || 0} recordings (${data.failed || 0} failed)`;
      toast({
        title: "Audio Fetch Complete",
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Audio Fetch Failed",
        description: error.message || "Failed to fetch recordings",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "failed":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      case "in_progress":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getAgentName = (agentId: string | null | undefined) => {
    if (!agentId) return "Unknown Agent";
    const agent = agents?.find(a => a.id === agentId);
    return agent?.name || "Unknown Agent";
  };

  const handleAudioPlayPause = (audioUrl: string, callId: string) => {
    // If this audio is already playing, toggle pause
    if (currentTrackId === callId) {
      togglePlayPause();
      return;
    }

    // Queue the audio for playback
    queueAudio({
      id: callId,
      url: audioUrl,
      title: `Call ${callId.slice(-6)}`,
      onEnd: () => {
        // Optional: Add any cleanup logic here
      }
    });
  };

  // Filter call logs based on selected filters
  const filteredCallLogs = (searchResults || callLogs)?.filter((log: CallLog) => {
    // Filter by agent
    if (selectedAgent && log.agentId !== selectedAgent.id) {
      return false;
    }

    // Filter by status
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false;
    }

    // Filter by duration
    if (durationFilter !== "all" && log.duration) {
      const duration = log.duration;
      switch (durationFilter) {
        case "short":
          if (duration >= 60) return false; // Less than 1 minute
          break;
        case "medium":
          if (duration < 60 || duration >= 300) return false; // 1-5 minutes
          break;
        case "long":
          if (duration < 300) return false; // More than 5 minutes
          break;
      }
    }

    // Filter by date range
    if ((startDate || endDate) && log.createdAt) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];

      // Check if log date is within the range
      if (startDate && logDate && logDate < startDate) {
        return false;
      }
      if (endDate && logDate && logDate > endDate) {
        return false;
      }
    }

    return true;
  }) || [];

  // Prepare export data
  const exportData = filteredCallLogs.map((log: CallLog) => ({
    id: log.id,
    agent: getAgentName(log.agentId),
    date: log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown",
    duration: formatDuration(log.duration || null),
    status: log.status || "unknown",
    cost: log.cost ? `$${Number(log.cost).toFixed(4)}` : "N/A",
    hasTranscript: !!log.transcript,
    hasAudio: !!log.recordingUrl
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent" data-testid="text-page-title">
            Call History
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-page-description">
            View and analyze past voice interactions with advanced playback controls
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {/* First Row - Sync and Agent Filter */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              onClick={() => syncCallsMutation.mutate()}
              disabled={syncCallsMutation.isPending}
              className="flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:scale-[1.02] transition-all"
              data-testid="button-sync-calls"
            >
              <RefreshCw className={`w-4 h-4 ${syncCallsMutation.isPending ? 'animate-spin' : ''}`} />
              {syncCallsMutation.isPending ? 'Syncing...' : 'Sync Calls'}
            </Button>
            <Button
              onClick={() => generateSummariesMutation.mutate()}
              disabled={generateSummariesMutation.isPending}
              variant="outline"
              className="flex items-center justify-center gap-2 w-full sm:w-auto hover:bg-primary/10 hover:border-primary/50 transition-all"
              data-testid="button-generate-summaries"
            >
              <Bot className={`w-4 h-4 ${generateSummariesMutation.isPending ? 'animate-spin' : ''}`} />
              {generateSummariesMutation.isPending ? 'Generating...' : 'Generate Summaries'}
            </Button>
            <Button
              onClick={() => fetchAudioMutation.mutate()}
              disabled={fetchAudioMutation.isPending}
              variant="outline"
              className="flex items-center justify-center gap-2 w-full sm:w-auto hover:bg-primary/10 hover:border-primary/50 transition-all"
              data-testid="button-fetch-audio"
            >
              <Download className={`w-4 h-4 ${fetchAudioMutation.isPending ? 'animate-spin' : ''}`} />
              {fetchAudioMutation.isPending ? 'Fetching...' : 'Fetch Audio'}
            </Button>
            <Select
              value={selectedAgent?.id || "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  setSelectedAgent(null);
                } else {
                  const agent = agents.find(a => a.id === value);
                  if (agent) setSelectedAgent(agent);
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48" data-testid="select-agent-filter">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Second Row - Date Range */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
              className="w-full sm:w-36"
              placeholder="Start date"
              data-testid="input-start-date"
            />
            <span className="text-gray-500 dark:text-gray-400 text-sm hidden sm:inline">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full sm:w-36"
              placeholder="End date"
              data-testid="input-end-date"
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                data-testid="button-clear-date-range"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters and Search */}
        <div className="space-y-4">
          {/* Transcript Search */}
          <TranscriptSearch
            callLogs={callLogs || []}
            onSearchResults={setSearchResults}
            onClearSearch={() => setSearchResults(null)}
          />

          {/* Advanced Filters Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2"
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4" />
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </Button>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <Card className="p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Duration
                  </label>
                  <Select value={durationFilter} onValueChange={setDurationFilter}>
                    <SelectTrigger data-testid="select-duration-filter">
                      <SelectValue placeholder="All Durations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Durations</SelectItem>
                      <SelectItem value="short">Short (&lt; 1 min)</SelectItem>
                      <SelectItem value="medium">Medium (1-5 min)</SelectItem>
                      <SelectItem value="long">Long (&gt; 5 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatusFilter("all");
                      setDurationFilter("all");
                      setSelectedAgent(null);
                      setStartDate("");
                      setEndDate("");
                      setSearchResults(null);
                    }}
                    className="flex-1"
                    data-testid="button-reset-filters"
                  >
                    Reset All Filters
                  </Button>
                </div>
              </div>

              {/* Export Options */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredCallLogs.length} call{filteredCallLogs.length !== 1 ? 's' : ''} found
                  </div>
                  <AnalyticsExport
                    data={exportData}
                    filename="call_history"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Call History Table */}
      <Card className="border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!filteredCallLogs || filteredCallLogs.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-calls-title">
              No call history found
            </h3>
            <p className="text-gray-600 dark:text-gray-400" data-testid="text-no-calls-description">
              {searchResults !== null
                ? "No calls match your search query. Try different keywords."
                : callLogs && callLogs.length > 0
                  ? "No calls match your current filters. Try adjusting the filters."
                  : "Call logs will appear here once your agents start receiving calls."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4 p-4">
              {filteredCallLogs.map((callLog: CallLog) => (
                <Card key={callLog.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                        <Bot className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white" data-testid={`text-call-id-${callLog.id}`}>
                          {callLog.phoneNumber ? callLog.phoneNumber : `Call #${callLog.id.slice(-6)}`}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400" data-testid={`text-agent-name-${callLog.id}`}>
                          {getAgentName(callLog.agentId)}
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(callLog.status)} data-testid={`badge-status-${callLog.id}`}>
                      {callLog.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="text-gray-900 dark:text-white" data-testid={`text-call-time-${callLog.id}`}>
                        {callLog.createdAt ? new Date(callLog.createdAt).toLocaleString() : "Unknown"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="text-gray-900 dark:text-white" data-testid={`text-duration-${callLog.id}`}>
                        {formatDuration(callLog.duration || null)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {callLog.recordingUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAudioPlayPause(callLog.recordingUrl!, callLog.id)}
                          data-testid={`button-play-audio-${callLog.id}`}
                        >
                          {currentTrackId === callLog.id ? (
                            <>
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Play
                            </>
                          )}
                        </Button>
                        <a
                          href={callLog.recordingUrl}
                          download={`call-${callLog.id.slice(-6)}.mp3`}
                          className="flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                          data-testid={`link-download-audio-${callLog.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedCallLog(callLog)}
                      data-testid={`button-view-details-${callLog.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Call Details
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Summary
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recording
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCallLogs.map((callLog: CallLog) => (
                    <tr key={callLog.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-call-id-${callLog.id}`}>
                            {callLog.phoneNumber ? (
                              <span className="font-semibold">{callLog.phoneNumber}</span>
                            ) : (
                              <span>Call #{callLog.id.slice(-6)}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400" data-testid={`text-call-time-${callLog.id}`}>
                            {callLog.createdAt ? new Date(callLog.createdAt).toLocaleString() : "Unknown"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                            <Bot className="w-4 h-4 text-primary-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-agent-name-${callLog.id}`}>
                            {getAgentName(callLog.agentId)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white" data-testid={`text-duration-${callLog.id}`}>
                        {formatDuration(callLog.duration || null)}
                      </td>
                      <td className="px-6 py-4">
                        {callLog.summary ? (
                          <div className="max-w-xs">
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate" data-testid={`text-summary-${callLog.id}`}>
                              {callLog.summary.slice(0, 100)}...
                            </p>
                            <Badge className="mt-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" variant="secondary">
                              Generated
                            </Badge>
                          </div>
                        ) : callLog.transcript ? (
                          <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" variant="secondary">
                            Pending
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200" variant="secondary">
                            No transcript
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {callLog.recordingUrl ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="group hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                              onClick={() => handleAudioPlayPause(callLog.recordingUrl!, callLog.id)}
                              data-testid={`button-play-audio-${callLog.id}`}
                              disabled={audioLoading}
                            >
                              {audioLoading && currentTrackId === callLog.id ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-1 text-purple-600 dark:text-purple-400 animate-spin" />
                                  Loading
                                </>
                              ) : currentTrackId === callLog.id && isPlaying ? (
                                <>
                                  <Pause className="w-4 h-4 mr-1 text-purple-600 dark:text-purple-400" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-1 text-purple-600 dark:text-purple-400" />
                                  Play
                                </>
                              )}
                            </Button>
                            <a
                              href={callLog.recordingUrl}
                              download={`call-${callLog.id.slice(-6)}.mp3`}
                              className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                              title="Download recording"
                              data-testid={`link-download-audio-${callLog.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">No recording</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusColor(callLog.status)} data-testid={`badge-status-${callLog.id}`}>
                          {callLog.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCallLog(callLog)}
                          data-testid={`button-view-details-${callLog.id}`}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {filteredCallLogs && filteredCallLogs.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-600">
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left" data-testid="text-pagination-info">
              Showing 1 to {filteredCallLogs.length} of {filteredCallLogs.length} results
            </div>
            <div className="flex items-center justify-center sm:justify-end space-x-2">
              <Button variant="outline" size="sm" disabled data-testid="button-previous-page">
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">&lt;</span>
              </Button>
              <Button size="sm" data-testid="button-current-page">1</Button>
              <Button variant="outline" size="sm" disabled data-testid="button-next-page">
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">&gt;</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CallDetailModal
        callLog={selectedCallLog}
        open={!!selectedCallLog}
        onOpenChange={(open) => !open && setSelectedCallLog(null)}
      />
    </div>
  );
}
