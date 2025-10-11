import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, Phone, User, Bot, Download, Copy, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface TranscriptViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: any;
  metadata?: {
    conversationId?: string;
    agentName?: string;
    duration?: number;
    createdAt?: string;
    cost?: string;
    audioUrl?: string;
  };
}

export function TranscriptViewer({ open, onOpenChange, transcript, metadata }: TranscriptViewerProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);

  // Parse transcript based on format
  const parseTranscript = () => {
    if (!transcript) return [];
    
    // Handle string transcript
    if (typeof transcript === 'string') {
      // Split by speaker changes (look for patterns like "Agent:" or "User:")
      const lines = transcript.split('\n').filter(line => line.trim());
      return lines.map((line, index) => {
        const isAgent = line.toLowerCase().includes('agent:') || line.toLowerCase().includes('assistant:');
        const isUser = line.toLowerCase().includes('user:') || line.toLowerCase().includes('customer:');
        
        let speaker = 'unknown';
        let text = line;
        
        if (isAgent) {
          speaker = 'agent';
          text = line.replace(/^(agent|assistant):\s*/i, '');
        } else if (isUser) {
          speaker = 'user';
          text = line.replace(/^(user|customer):\s*/i, '');
        }
        
        return {
          id: index,
          speaker,
          text: text.trim(),
          timestamp: null
        };
      });
    }
    
    // Handle array of transcript entries
    if (Array.isArray(transcript)) {
      return transcript.map((entry, index) => ({
        id: entry.id || index,
        speaker: entry.role || entry.speaker || 'unknown',
        text: entry.content || entry.text || entry.message || '',
        timestamp: entry.timestamp || null
      }));
    }
    
    // Handle object with messages array
    if (transcript.messages && Array.isArray(transcript.messages)) {
      return transcript.messages.map((msg: any, index: number) => ({
        id: index,
        speaker: msg.role || msg.speaker || 'unknown',
        text: msg.content || msg.text || '',
        timestamp: msg.timestamp || null
      }));
    }
    
    return [];
  };

  const transcriptEntries = parseTranscript();

  const copyTranscript = () => {
    const text = transcriptEntries
      .map((entry: any) => `${entry.speaker === 'agent' ? 'Agent' : entry.speaker === 'user' ? 'User' : 'Unknown'}: ${entry.text}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Transcript copied to clipboard",
    });
  };

  const downloadTranscript = () => {
    const text = transcriptEntries
      .map((entry: any) => `${entry.speaker === 'agent' ? 'Agent' : entry.speaker === 'user' ? 'User' : 'Unknown'}: ${entry.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${metadata?.conversationId || 'unknown'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const playAudio = () => {
    if (metadata?.audioUrl) {
      // Handle audio playback
      setIsPlaying(!isPlaying);
      // In a real implementation, you'd have an audio element to control
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Call Transcript</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyTranscript}>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTranscript}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {metadata?.audioUrl && (
                <Button variant="outline" size="sm" onClick={playAudio}>
                  <Volume2 className="h-4 w-4 mr-1" />
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Metadata Card */}
        {metadata && (
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metadata.conversationId && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Call ID</p>
                    <p className="text-sm font-mono">{metadata.conversationId.slice(0, 8)}...</p>
                  </div>
                </div>
              )}
              {metadata.agentName && (
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Agent</p>
                    <p className="text-sm font-medium">{metadata.agentName}</p>
                  </div>
                </div>
              )}
              {metadata.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">{formatDuration(metadata.duration)}</p>
                  </div>
                </div>
              )}
              {metadata.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium">
                      {new Date(metadata.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Transcript Content */}
        <ScrollArea className="flex-1 w-full pr-4">
          <div className="space-y-4">
            {transcriptEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transcript available
              </div>
            ) : (
              transcriptEntries.map((entry: any) => (
                <div
                  key={entry.id}
                  className={`flex gap-3 ${
                    entry.speaker === 'agent' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`p-1 rounded-full ${
                    entry.speaker === 'agent' 
                      ? 'bg-primary text-primary-foreground' 
                      : entry.speaker === 'user'
                      ? 'bg-muted'
                      : 'bg-gray-300'
                  }`}>
                    {entry.speaker === 'agent' ? (
                      <Bot className="h-4 w-4" />
                    ) : entry.speaker === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                  </div>
                  <div className={`flex-1 ${
                    entry.speaker === 'agent' ? 'text-right' : ''
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {entry.speaker === 'agent' ? 'Agent' : entry.speaker === 'user' ? 'User' : 'Unknown'}
                      </Badge>
                      {entry.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className={`inline-block p-3 rounded-lg ${
                      entry.speaker === 'agent'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}