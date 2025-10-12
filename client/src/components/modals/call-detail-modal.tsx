import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bot, Sparkles, Loader2, AlertCircle, Download } from "lucide-react";
import { SentimentIndicator } from "@/components/analytics/sentiment-indicator";
import type { CallLog, SummaryMetadata } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

interface CallDetailModalProps {
  callLog: CallLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetadataDisplay({ metadata }: { metadata: SummaryMetadata | null }) {
  if (!metadata) return null;
  
  return (
    <div className="flex gap-3">
      {metadata.model && <span>Model: {metadata.model}</span>}
      {metadata.tokens && <span>Tokens: {metadata.tokens}</span>}
      {metadata.cost && <span>Cost: ${Number(metadata.cost).toFixed(4)}</span>}
    </div>
  );
}

export function CallDetailModal({ callLog, open, onOpenChange }: CallDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);

  // Auto-fetch recording when modal opens if needed
  useEffect(() => {
    if (open && callLog && !callLog.recordingUrl && !callLog.audioStorageKey && callLog.conversationId) {
      fetchRecording();
    }
    // Reset audio URL when modal closes or callLog changes
    if (!open || !callLog) {
      setAudioUrl(null);
    } else if (callLog.recordingUrl) {
      setAudioUrl(callLog.recordingUrl);
    }
  }, [open, callLog?.id]);

  // Fetch recording function
  const fetchRecording = async () => {
    if (!callLog?.conversationId) return;
    
    setIsFetchingAudio(true);
    try {
      console.log(`Auto-fetching recording for call: ${callLog.id}`);
      const response = await apiRequest("GET", `/api/recordings/${callLog.id}/audio`);
      
      // The API returns binary audio data, so we need to create a blob URL
      if (response instanceof Blob || response instanceof ArrayBuffer) {
        const blob = response instanceof Blob ? response : new Blob([response], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        console.log(`Recording fetched successfully for call: ${callLog.id}`);
      }
    } catch (error: any) {
      console.error(`Failed to fetch recording for call ${callLog?.id}:`, error);
      // Don't show error toast since recording might not exist for all calls
    } finally {
      setIsFetchingAudio(false);
    }
  };

  // Summary generation mutation
  const generateSummaryMutation = useMutation({
    mutationFn: (callLogId: string) => apiRequest("POST", `/api/call-logs/${callLogId}/summary`) as Promise<any>,
    onSuccess: (data: any) => {
      toast({
        title: "Summary Generated",
        description: data.cached 
          ? "Summary retrieved from cache" 
          : "AI summary generated successfully",
      });
      // Invalidate call logs cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs", callLog?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Summary Generation Failed",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    },
  });

  if (!callLog) return null;

  const summaryMetadata = callLog.summaryMetadata;
  const hasTranscript = Boolean(callLog.transcript);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = (status: string) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg" data-testid="text-modal-title">
            Call Details #{callLog.id.slice(-6)}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            View detailed information about this voice agent call including transcript, duration, and status.
          </DialogDescription>
        </DialogHeader>
        
        {/* Call Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Agent:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-agent">
                Agent ID: {callLog.agentId}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-duration">
                {formatDuration(callLog.duration)}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
              <Badge className={getStatusColor(callLog.status || 'unknown')} data-testid="badge-call-status">
                {callLog.status || 'unknown'}
              </Badge>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-timestamp">
                {callLog.createdAt ? new Date(callLog.createdAt).toLocaleString() : "Unknown"}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cost:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-cost">
                ${callLog.cost ? Number(callLog.cost).toFixed(4) : "N/A"}
              </p>
            </div>
            {callLog.elevenLabsCallId && (
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Call ID:</span>
                <p className="text-sm text-gray-900 dark:text-white font-mono" data-testid="text-call-id">
                  {callLog.elevenLabsCallId}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary Section */}
        <div className="mb-4 sm:mb-6" data-testid="section-ai-summary">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Summary
            </h4>
            {callLog.summaryStatus === 'success' && (
              <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" data-testid="badge-summary-status">
                Generated
              </Badge>
            )}
            {callLog.summaryStatus === 'failed' && (
              <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" data-testid="badge-summary-status">
                Failed
              </Badge>
            )}
          </div>
          
          {!callLog.summary && !generateSummaryMutation.isPending ? (
            <Card className="p-4 sm:p-6 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-dashed border-purple-200 dark:border-purple-800">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-purple-500 dark:text-purple-400 mb-3" />
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2">
                Generate AI Summary
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                Get an AI-powered summary of this call including outcome, intent, key topics, and action items.
              </p>
              <Button
                onClick={() => generateSummaryMutation.mutate(callLog.id)}
                disabled={!hasTranscript || generateSummaryMutation.isPending}
                className="flex items-center gap-2"
                data-testid="button-generate-summary"
              >
                <Sparkles className="w-4 h-4" />
                {!hasTranscript ? "No Transcript Available" : "Generate Summary"}
              </Button>
            </Card>
          ) : null}

          {generateSummaryMutation.isPending ? (
            <Card className="p-4 sm:p-6 text-center">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-blue-500 dark:text-blue-400 mb-3 animate-spin" />
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2">
                Generating Summary...
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                AI is analyzing the call transcript. This may take a few moments.
              </p>
            </Card>
          ) : null}

          {callLog.summary ? (
            <Card className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-700">
              <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-call-summary">
                <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                  {callLog.summary}
                </div>
              </div>
              {callLog.summaryGeneratedAt ? (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Generated: {new Date(callLog.summaryGeneratedAt).toLocaleString()}</span>
                  <MetadataDisplay metadata={summaryMetadata} />
                </div>
              ) : null}
              {callLog.summaryStatus === 'failed' ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Summary generation failed. Click "Generate Summary" to retry.</span>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        {/* Call Recording with Professional Audio Player */}
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Call Recording</h4>
          <Card className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700">
            {isFetchingAudio ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 mx-auto text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Fetching recording...</p>
              </div>
            ) : audioUrl || callLog.recordingUrl || callLog.audioStorageKey ? (
              <div className="space-y-3 sm:space-y-4">
                {/* Waveform Visualization */}
                <div className="h-12 sm:h-16 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 sm:gap-1 h-8 sm:h-12">
                      {Array.from({ length: 30 }, (_, i) => (
                        <div
                          key={i}
                          className="bg-blue-500 dark:bg-blue-400 opacity-70 hover:opacity-100 transition-opacity"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 35 + 8}px`,
                            borderRadius: '1px'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-1 sm:bottom-2 left-2 sm:left-4 text-[10px] sm:text-xs text-blue-600 dark:text-blue-300 font-medium">
                    Audio Waveform
                  </div>
                </div>
                
                {/* Audio Controls */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <audio controls className="w-full sm:flex-1 sm:max-w-md" data-testid="audio-call-recording">
                    <source src={audioUrl || callLog.recordingUrl || ""} type="audio/mpeg" />
                    <source src={audioUrl || callLog.recordingUrl || ""} type="audio/wav" />
                    <source src={audioUrl || callLog.recordingUrl || ""} type="audio/mp4" />
                    Your browser does not support the audio element.
                  </audio>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="block sm:inline">Duration: {callLog.duration ? `${Math.floor(callLog.duration / 60)}:${String(callLog.duration % 60).padStart(2, '0')}` : 'N/A'}</span>
                    <a
                      href={audioUrl || callLog.recordingUrl || ""}
                      download={`call-recording-${callLog.elevenLabsCallId || callLog.id}.mp3`}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                      data-testid="link-download-recording"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
                
                {/* Recording Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span>High-quality audio recording</span>
                  <span>Encrypted & secure storage</span>
                </div>
              </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">No recording available for this call</p>
                  <Button 
                    onClick={fetchRecording}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    data-testid="button-fetch-recording"
                  >
                    <Download className="w-4 h-4" />
                    Fetch Recording
                  </Button>
                </div>
              )}
            </Card>
          </div>

        {/* Transcript */}
        {callLog.transcript && (
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Call Transcript</h4>
              <SentimentIndicator transcript={callLog.transcript} showDetails={false} />
            </div>
            <Card className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 max-h-48 sm:max-h-64 overflow-y-auto">
              <div className="space-y-3" data-testid="text-call-transcript">
                {(() => {
                  try {
                    let transcript = callLog.transcript;
                    let conversationTurns = [];
                    
                    // Check if transcript is already an array
                    if (Array.isArray(transcript)) {
                      conversationTurns = transcript;
                    } else if (typeof transcript === 'string') {
                      // Try to parse as JSON
                      try {
                        const parsed = JSON.parse(transcript);
                        if (Array.isArray(parsed)) {
                          conversationTurns = parsed;
                        }
                      } catch (e) {
                        // If parsing fails, treat as a single message
                        conversationTurns = [{ role: 'system', message: transcript }];
                      }
                    } else if (typeof transcript === 'object' && transcript !== null) {
                      // If it's an object, try to extract conversation turns
                      conversationTurns = Object.values(transcript);
                    }
                    
                    // Filter out empty messages and ensure proper structure
                    conversationTurns = conversationTurns.filter((turn: any) => 
                      turn && turn.message && turn.message.trim()
                    );
                    
                    // Sort by timestamp to maintain conversation order
                    conversationTurns.sort((a: any, b: any) => (a.time_in_call_secs || 0) - (b.time_in_call_secs || 0));
                    
                    // Render professional conversation
                    if (conversationTurns.length > 0) {
                      return (
                        <div className="space-y-3 sm:space-y-4">
                          {conversationTurns.map((turn, index) => (
                            <div key={index} className={`flex ${
                              turn.role === 'agent' ? 'justify-start' : 'justify-end'
                            }`}>
                              <div className={`max-w-[85%] sm:max-w-[75%] ${
                                turn.role === 'agent' ? 'mr-2 sm:mr-8' : 'ml-2 sm:ml-8'
                              }`}>
                                <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm ${
                                  turn.role === 'agent' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white'
                                }`}>
                                  <p className="text-xs sm:text-sm leading-relaxed">
                                    {turn.message}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-1 sm:gap-2 mt-1 text-[10px] sm:text-xs text-gray-500 ${
                                  turn.role === 'agent' ? 'justify-start' : 'justify-end'
                                }`}>
                                  <span className="font-medium">
                                    {turn.role === 'agent' ? 'AI Agent' : 'Customer'}
                                  </span>
                                  {turn.time_in_call_secs !== undefined && (
                                    <span>
                                      {Math.floor(turn.time_in_call_secs / 60)}:{String(turn.time_in_call_secs % 60).padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    // No conversation data available
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <p>No conversation transcript available</p>
                      </div>
                    );
                  } catch (e) {
                    return (
                      <div className="text-center py-8 text-red-500">
                        <p>Unable to load conversation transcript</p>
                      </div>
                    );
                  }
                })()}
              </div>
            </Card>
          </div>
        )}

        {!callLog.transcript && !callLog.recordingUrl && (
          <Card className="p-6 sm:p-8 text-center">
            <Bot className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-data-title">
              No additional data available
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-testid="text-no-data-description">
              This call log contains basic information only. Audio and transcript data may be available for newer calls.
            </p>
          </Card>
        )}

        <div className="mt-4 sm:mt-6 flex justify-end">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto" data-testid="button-close-modal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
