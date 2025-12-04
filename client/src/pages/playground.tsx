import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import {
  Mic, MicOff, Volume2, VolumeX,
  Loader2, Activity, MessageSquare,
  Bot, User, Trash2, FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { useAgentContext } from "@/contexts/agent-context";
import { useAuth } from "@/hooks/useAuth";
import { VoiceButton } from "@/components/ui/voice-button";
import { Waveform } from "@/components/ui/waveform";

interface ConversationMessage {
  role: "assistant" | "user";
  message: string;
  timestamp: Date;
}

export default function Playground() {
  const { selectedAgent, setSelectedAgent, agents } = useAgentContext();
  const { user } = useAuth();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);

  // Check if user has WebRTC permission
  const hasWebRTCPermission = user?.permissions?.includes('use_webrtc') || user?.isAdmin || false;
  const [connectionType, setConnectionType] = useState<'websocket' | 'webrtc'>('websocket');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const { toast } = useToast();

  // Get loading state for agents from context
  const agentsLoading = agents.length === 0;

  // Fetch integration to get API key status
  const { data: integration } = useQuery<any>({
    queryKey: ["/api/integrations"],
    retry: 1,
    queryFn: async () => {
      try {
        const response = await fetch('/api/integrations', { credentials: 'include' });
        if (!response.ok) {
          if (response.status === 403) {
            // Non-admin users don't have permission to view integration status
            // Return a special value to indicate permission denied
            return { permissionDenied: true };
          }
          throw new Error('Failed to fetch integration');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching integration:', error);
        throw error;
      }
    },
  });

  // Auto-scroll transcript - updated to work properly with ScrollArea
  useEffect(() => {
    if (transcript.length > 0 && transcriptScrollRef.current) {
      // Find the viewport element inside ScrollArea
      const viewport = transcriptScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        // Scroll to bottom of the viewport
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Update call duration
  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (!selectedAgent) {
      toast({
        title: "Select an agent",
        description: "Please select an agent to test",
        variant: "destructive",
      });
      return;
    }

    // Check if integration exists and is active
    if (!integration) {
      const isAdmin = user?.isAdmin || user?.permissions?.includes('manage_integrations');
      toast({
        title: "API not configured",
        description: isAdmin
          ? "Please add your EchoSensei API key in the Integrations tab"
          : "EchoSensei API key not configured. Please contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    // Handle permission denied case for non-admin users
    if (integration.permissionDenied) {
      // For non-admin users, we can't check the integration status
      // So we'll try to proceed with the call and let the backend handle it
      console.log('Non-admin user, proceeding with call attempt');
    } else if (integration.status !== "ACTIVE") {
      toast({
        title: "API integration inactive",
        description: "Please test your API key in the Integrations tab to activate it",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (!selectedAgent) return;

      console.log('Selected agent:', selectedAgent);
      console.log('Agent ID to send:', selectedAgent.id);
      console.log('ElevenLabs Agent ID:', selectedAgent.elevenLabsAgentId);

      // Get connection details (WebRTC or WebSocket)
      // Send the database agent ID, backend will look up the ElevenLabs agent ID
      const response = await apiRequest("POST", "/api/playground/start-session", {
        agentId: selectedAgent.id,  // Send database ID, not ElevenLabs ID
        connectionType: connectionType
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to start session");
      }

      const { signedUrl, conversationToken, connectionType: responseConnectionType } = data;

      // Handle WebRTC connection (2025 feature)
      if (responseConnectionType === 'webrtc' && conversationToken) {
        // For now, show message that WebRTC is prepared but fall back to WebSocket
        // Full WebRTC implementation requires the voice AI React SDK
        // WebRTC token received
        toast({
          title: "WebRTC Ready",
          description: "Using enhanced WebRTC connection for better audio quality",
        });

        // TODO: Implement full WebRTC connection with voice AI SDK
        // For now, we'll prepare for WebRTC but need the proper SDK integration
        throw new Error('WebRTC connection requires voice AI React SDK. Please use WebSocket for now.');
      }

      // Connect to WebSocket
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        setIsCallActive(true);

        // Start sending audio
        startAudioStreaming(stream, ws);

        toast({
          title: "Connected",
          description: `Connected to ${selectedAgent.name}`,
        });
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'audio') {
          // Handle incoming audio
          if (message.audio_event?.audio_base_64) {
            queueAudio(message.audio_event.audio_base_64);
          }
        } else if (message.type === 'agent_response') {
          // Handle transcript
          if (message.agent_response_event?.agent_response) {
            setTranscript(prev => [...prev, {
              role: 'assistant',
              message: message.agent_response_event.agent_response,
              timestamp: new Date()
            }]);
          }
        } else if (message.type === 'user_transcript') {
          // Handle user transcript
          if (message.user_transcript_event?.user_transcript) {
            setTranscript(prev => [...prev, {
              role: 'user',
              message: message.user_transcript_event.user_transcript,
              timestamp: new Date()
            }]);
          }
        } else if (message.type === 'interruption') {
          // Handle interruption - clear audio queue
          audioQueueRef.current = [];
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          isPlayingRef.current = false;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice server",
          variant: "destructive",
        });
        endCall();
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        endCall();
      };

    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start call",
        variant: "destructive",
      });
      setIsConnecting(false);
      endCall();
    }
  };

  const endCall = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setIsCallActive(false);
    setIsConnecting(false);

    // Clear audio queue
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const startAudioStreaming = (stream: MediaStream, ws: WebSocket) => {
    // Starting audio streaming to WebSocket

    // Create audio context at 16kHz as required by voice service
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1); // Larger buffer for better performance

    let chunkCount = 0;
    let audioBuffer: number[] = [];
    let lastSendTime = Date.now();

    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN && !isMuted) {
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert float32 to PCM 16-bit and add to buffer
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i] || 0));
          const sample = s < 0 ? s * 0x8000 : s * 0x7FFF;
          audioBuffer.push(sample);
        }

        // Send chunks every 250ms as recommended by voice service
        const now = Date.now();
        if (now - lastSendTime >= 250 && audioBuffer.length > 0) {
          // Convert buffer to Int16Array
          const pcm16 = new Int16Array(audioBuffer);

          // Convert to base64
          const uint8 = new Uint8Array(pcm16.buffer);
          const binaryString = Array.from(uint8)
            .map(byte => String.fromCharCode(byte))
            .join('');
          const base64Audio = btoa(binaryString);

          // Send audio chunk
          const message = {
            user_audio_chunk: base64Audio
          };

          ws.send(JSON.stringify(message));
          chunkCount++;

          // Clear buffer and update time
          audioBuffer = [];
          lastSendTime = now;

          // Log every 10th chunk to avoid spam
          if (chunkCount % 10 === 0) {
            // Sent audio chunks (250ms intervals)
          }
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Store for cleanup
    (ws as any).audioProcessor = processor;
    (ws as any).audioContext = audioContext;

    // Audio streaming setup complete with 250ms chunking
  };

  // Queue audio chunks and play them sequentially
  const queueAudio = (audioData: string) => {
    audioQueueRef.current.push(audioData);
    processAudioQueue();
  };

  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !isSpeakerOn) {
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    try {
      // EchoSensei sends PCM 16-bit audio at 16kHz encoded in base64
      // We need to convert it to a playable format

      // Decode base64 to binary
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check if we have valid data
      if (bytes.length === 0 || bytes.length % 2 !== 0) {
        console.warn('Invalid audio data length:', bytes.length);
        isPlayingRef.current = false;
        processAudioQueue();
        return;
      }

      // Convert bytes to Int16Array (PCM 16-bit)
      const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);

      // Create WAV format for playback
      const wavBuffer = createWavFromPcm(pcmData, 16000); // 16kHz sample rate

      // Create blob and play
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      // Set volume to max
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      // When audio ends, process next in queue
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        processAudioQueue(); // Process next audio in queue
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        processAudioQueue(); // Continue with next audio even on error
      });

      // Use play() with catch to handle autoplay issues
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('Playing audio chunk, duration:', audio.duration);
        }).catch((error) => {
          console.error('Failed to play audio:', error);
          isPlayingRef.current = false;
          processAudioQueue();
        });
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      isPlayingRef.current = false;
      processAudioQueue(); // Continue processing queue on error
    }
  };

  // Helper function to create WAV header for PCM data
  const createWavFromPcm = (pcmData: Int16Array, sampleRate: number): ArrayBuffer => {
    const length = pcmData.length * 2; // 2 bytes per sample
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Copy PCM data with proper byte order
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(44 + i * 2, pcmData[i] || 0, true); // little-endian
    }

    return arrayBuffer;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Agent Playground
          </h1>
          <p className="text-muted-foreground">
            Test your voice AI agents with real-time voice conversations
          </p>
        </div>
        {isCallActive && (
          <Badge variant="outline" className="animate-pulse border-primary text-primary">
            <Activity className="w-3 h-3 mr-1" />
            Live Session
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Sidebar - Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
          {/* Agent Selection Card */}
          <Card className="p-6 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Configuration
            </h3>

            {/* Connection Type Toggle */}
            {hasWebRTCPermission && (
              <div className="mb-6 p-3 bg-muted/50 rounded-lg">
                <label className="text-xs font-medium mb-2 block text-muted-foreground uppercase tracking-wider">Connection</label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setConnectionType('webrtc')}
                    variant={connectionType === 'webrtc' ? "default" : "ghost"}
                    size="sm"
                    disabled={isCallActive}
                    className="flex-1"
                  >
                    WebRTC
                  </Button>
                  <Button
                    onClick={() => setConnectionType('websocket')}
                    variant={connectionType === 'websocket' ? "default" : "ghost"}
                    size="sm"
                    disabled={isCallActive}
                    className="flex-1"
                  >
                    WebSocket
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Agent</Label>
                <Select
                  value={selectedAgent?.id || ""}
                  onValueChange={(value) => {
                    const agent = agents.find(a => a.id === value);
                    if (agent) setSelectedAgent(agent);
                  }}
                  disabled={isCallActive}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentsLoading ? (
                      <div className="p-2 text-center">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </div>
                    ) : agents.length > 0 ? (
                      agents.map((agent: Agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-center text-muted-foreground">
                        No agents configured
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedAgent && (
                <div className="p-4 rounded-lg bg-muted/30 space-y-3 text-sm border">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Description</span>
                    <p className="line-clamp-2">{selectedAgent.description || "No description"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Voice ID</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{selectedAgent.voiceId || "Default"}</code>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Session Controls */}
          <Card className="p-6 shadow-lg border-0 bg-card/50 backdrop-blur-sm flex-1 flex flex-col justify-center items-center text-center space-y-6">
            <div className="relative">
              <VoiceButton
                isRecording={isCallActive}
                onStartRecording={startCall}
                onStopRecording={endCall}
                disabled={isConnecting || !selectedAgent}
              />
              {isConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                {isCallActive ? "Session Active" : isConnecting ? "Connecting..." : "Start Session"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                {isCallActive
                  ? `Connected to ${selectedAgent?.name}`
                  : "Click the microphone to start a voice conversation"}
              </p>
            </div>

            {isCallActive && (
              <div className="flex items-center gap-4 w-full justify-center pt-4 border-t">
                <Button
                  variant="outline"
                  size="icon"
                  className={isMuted ? "bg-destructive/10 text-destructive border-destructive/20" : ""}
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <div className="font-mono text-lg font-medium w-20">
                  {formatDuration(callDuration)}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className={!isSpeakerOn ? "text-muted-foreground" : ""}
                  onClick={toggleSpeaker}
                >
                  {isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Side - Visualization & Transcript */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
          {/* Audio Visualization */}
          <Card className="p-6 shadow-lg border-0 bg-gradient-to-br from-card to-muted/20 flex flex-col justify-center items-center min-h-[200px]">
            <div className="w-full max-w-2xl flex flex-col items-center gap-8">
              <div className="w-full flex items-center justify-center h-32">
                {isCallActive ? (
                  <Waveform active={true} bars={40} className="h-24 gap-1 text-primary" />
                ) : (
                  <div className="flex items-center gap-4 text-muted-foreground/50">
                    <div className="h-1 w-12 bg-current rounded-full" />
                    <div className="h-1 w-8 bg-current rounded-full" />
                    <div className="h-1 w-16 bg-current rounded-full" />
                    <div className="h-1 w-10 bg-current rounded-full" />
                    <div className="h-1 w-12 bg-current rounded-full" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isCallActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                {isCallActive ? "Voice Activity Detected" : "Ready to connect"}
              </div>
            </div>
          </Card>

          {/* Transcript */}
          <Card className="flex-1 shadow-lg border-0 bg-card/50 backdrop-blur-sm flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Live Transcript
              </h3>
              {transcript.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTranscript([])}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-4" ref={transcriptScrollRef}>
              <div className="space-y-4" ref={transcriptEndRef}>
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 opacity-50">
                    <FileText className="w-12 h-12 mb-4" />
                    <p>Transcript will appear here...</p>
                  </div>
                ) : (
                  transcript.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted rounded-tl-none"
                          }`}
                      >
                        <p>{msg.message}</p>
                        <span className="text-[10px] opacity-50 mt-1 block">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}