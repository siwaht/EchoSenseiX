import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { SentimentIndicator } from "@/components/analytics/sentiment-indicator";
import type { CallLog } from "@shared/schema";


interface CallDetailModalProps {
  callLog: CallLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailModal({ callLog: propCallLog, open, onOpenChange }: CallDetailModalProps) {
  const callLog = propCallLog as CallLog;


  if (!callLog && open) return null;
  if (!callLog) return null;

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

        {/* Summary */}
        {!!callLog.summary && (
          <Card className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 mb-4 sm:mb-6">
            <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-call-summary">
              <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                {String(callLog.summary || '')}
              </div>
            </div>
            {callLog.summaryGeneratedAt && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Generated: {new Date(callLog.summaryGeneratedAt).toLocaleString()}</span>
              </div>
            )}
            {callLog.summaryStatus === 'failed' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <span>Summary generation failed.</span>
              </div>
            )}
          </Card>
        )}

        {/* Transcript */}
        {/* Transcript */}
        {!!callLog.transcript && (
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
                    let conversationTurns: any[] = [];

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
                            <div key={index} className={`flex ${turn.role === 'agent' ? 'justify-start' : 'justify-end'
                              }`}>
                              <div className={`max-w-[85%] sm:max-w-[75%] ${turn.role === 'agent' ? 'mr-2 sm:mr-8' : 'ml-2 sm:ml-8'
                                }`}>
                                <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm ${turn.role === 'agent'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white'
                                  }`}>
                                  <p className="text-xs sm:text-sm leading-relaxed">
                                    {turn.message}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-1 sm:gap-2 mt-1 text-[10px] sm:text-xs text-gray-500 ${turn.role === 'agent' ? 'justify-start' : 'justify-end'
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

        {/* No Data Fallback */}
        {!callLog.transcript && !callLog.recordingUrl && (
          <Card className="p-6 sm:p-8 text-center mt-4">
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
