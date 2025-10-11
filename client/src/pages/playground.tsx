import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Loader2, Activity, Circle, AlertCircle, Send, MessageSquare, 
  Bot, User, Sparkles, RefreshCw, Trash2, FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent, Integration } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAgentContext } from "@/contexts/agent-context";
import { useAuth } from "@/hooks/useAuth";

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
  const [audioLevel, setAudioLevel] = useState(0);
  // Check if user has WebRTC permission
  const hasWebRTCPermission = user?.permissions?.includes('use_webrtc') || user?.isAdmin || false;
  const [connectionType, setConnectionType] = useState<'websocket' | 'webrtc'>('websocket');
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
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
  const { data: integration, isLoading: integrationLoading, error: integrationError } = useQuery<any>({
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

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start audio level monitoring
      monitorAudioLevel();

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
      
      // Connect to EchoSensei WebSocket (legacy support)
      if (!signedUrl) {
        throw new Error('No connection URL received from server');
      }
      
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // WebSocket connected, sending initialization message
        
        // Send a simple initialization message without overrides
        // Overrides often fail due to agent security settings in voice platform
        const initMessage = {
          type: "conversation_initiation_client_data"
        };
        
        // Sending init message
        ws.send(JSON.stringify(initMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // WebSocket message received
          
          // Handle different message formats from EchoSensei
          if (data.type === "conversation_initiation_metadata") {
            // Conversation metadata received
            
            // Now we're ready to start the conversation
            setIsConnecting(false);
            setIsCallActive(true);
            
            // Start audio streaming after successful initialization
            if (mediaStreamRef.current) {
              // Starting audio stream to WebSocket
              startAudioStreaming(mediaStreamRef.current, ws);
            }
            
            toast({
              title: "Call started",
              description: `Connected to ${selectedAgent?.name}`,
            });
            
            // Send a small audio chunk to trigger the agent to speak first
            // This is a workaround for agents that don't automatically start
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                // Send a tiny silence to trigger agent response
                const silentAudio = new Int16Array(160); // 10ms of silence at 16kHz
                const uint8 = new Uint8Array(silentAudio.buffer);
                const binaryString = Array.from(uint8)
                  .map(byte => String.fromCharCode(byte))
                  .join('');
                const base64Audio = btoa(binaryString);
                
                ws.send(JSON.stringify({
                  user_audio_chunk: base64Audio
                }));
                // Sent trigger audio to start conversation
              }
            }, 500);
          } else if (data.audio || data.audio_event) {
            // Agent audio response - queue it for sequential playback
            const audioData = data.audio || data.audio_event?.audio_base_64 || data.audio_event?.audio || data.audio_base_64;
            if (audioData && isSpeakerOn) {
              // Queueing agent audio
              queueAudio(audioData);
            } else if (audioData) {
              // Received audio but speaker is off
            }
          } else if (data.audio_base_64) {
            // Some agents send audio directly as audio_base_64
            if (isSpeakerOn) {
              // Queueing agent audio (direct)
              queueAudio(data.audio_base_64);
            }
          } else if (data.user_transcription_event) {
            // Handle user transcript - voice API sends user_transcript field
            const userTranscript = data.user_transcription_event.user_transcript;
            if (userTranscript) {
              // User transcript received
              setTranscript(prev => [...prev, {
                role: "user",
                message: userTranscript,
                timestamp: new Date()
              }]);
            }
          } else if (data.agent_response_event) {
            // Handle agent response - voice API sends agent_response field
            const agentResponse = data.agent_response_event.agent_response;
            if (agentResponse) {
              // Agent response received
              setTranscript(prev => [...prev, {
                role: "assistant",
                message: agentResponse,
                timestamp: new Date()
              }]);
            }
          } else if (data.message) {
            // Simple text message from agent
            // Agent message received
            setTranscript(prev => [...prev, {
              role: "assistant",
              message: data.message,
              timestamp: new Date()
            }]);
          } else if (data.ping_event) {
            // Keep alive - respond with pong
            const pongMessage = {
              type: "pong_event",
              event_id: data.ping_event.event_id
            };
            ws.send(JSON.stringify(pongMessage));
            // Sent pong response
          } else if (data.error || data.error_event) {
            const errorInfo = data.error || data.error_event;
            console.error('Voice service error:', errorInfo);
            toast({
              title: "Agent Error",
              description: errorInfo.message || errorInfo.error || "Connection error occurred",
              variant: "destructive",
            });
            endCall();
          } else if (data.interruption_event) {
            // User interrupted agent
          } else if (data.agent_response_correction_event) {
            // Agent response correction
          } else {
            // Unhandled message type
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error, "Raw data:", event.data);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection error",
          description: "Failed to connect to agent",
          variant: "destructive",
        });
        endCall();
      };

      ws.onclose = (event) => {
        // WebSocket closed
        
        // Only show error if not a normal closure (1000 or 1001 are normal closures)
        if (!event.wasClean && event.code !== 1000 && event.code !== 1001) {
          // Check if this is an unexpected closure and we haven't already ended the call
          if (wsRef.current === ws && isCallActive) {
            toast({
              title: "Connection lost",
              description: `Connection closed unexpectedly (Code: ${event.code})`,
              variant: "destructive",
            });
            endCall();
          }
        } else if (event.code === 1000 || event.code === 1001) {
          // Normal closure, just cleanup
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
        }
      };

      // Audio streaming will start after conversation initialization

    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Failed to start call",
        description: error instanceof Error ? error.message : "Please check your microphone permissions",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    // Ending call immediately
    
    // Save duration before resetting
    const finalDuration = callDuration;
    
    // Immediately update UI state
    setIsCallActive(false);
    setIsConnecting(false);
    setCallDuration(0);
    setTranscript([]);
    setAudioLevel(0);
    
    // Clear audio queue and stop playback
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    
    // Stop all audio elements on page
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
      audio.remove();
    });
    
    // Close WebSocket immediately with normal closure code
    if (wsRef.current) {
      // Disconnect audio processor if it exists
      const ws: any = wsRef.current;
      if (ws.audioProcessor) {
        ws.audioProcessor.disconnect();
        ws.audioProcessor = null;
      }
      if (ws.audioContext && ws.audioContext.state !== 'closed') {
        try {
          ws.audioContext.close();
        } catch (e) {
          console.error('Error closing audio context from ws:', e);
        }
        ws.audioContext = null;
      }
      
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          wsRef.current.close(1000, 'User ended call');
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
      }
      wsRef.current = null;
    }
    
    // Stop media stream tracks immediately
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }

    // Close audio context immediately
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }
    
    toast({
      title: "Call ended",
      description: `Duration: ${formatDuration(finalDuration)}`,
    });
    
    // Call ended successfully
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!analyserRef.current || !isCallActive) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255); // Normalize to 0-1
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
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
          const s = Math.max(-1, Math.min(1, inputData[i]));
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
      view.setInt16(44 + i * 2, pcmData[i], true); // little-endian
    }
    
    return arrayBuffer;
  };


  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Agent Playground</h1>
        <p className="text-muted-foreground">
          Test your voice AI agents with real-time voice conversations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 shadow-lg border-0">
            <h3 className="font-semibold mb-3">Select Agent</h3>
            
            {/* Connection Type Toggle - Only show if user has permission */}
            {hasWebRTCPermission && (
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Connection Type</label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setConnectionType('webrtc')}
                    variant={connectionType === 'webrtc' ? "default" : "outline"}
                    size="sm"
                    disabled={isCallActive}
                    data-testid="button-webrtc-mode"
                    className="text-xs flex-1"
                  >
                    WebRTC
                  </Button>
                  <Button
                    onClick={() => setConnectionType('websocket')}
                    variant={connectionType === 'websocket' ? "default" : "outline"}
                    size="sm"
                    disabled={isCallActive}
                    data-testid="button-websocket-mode"
                    className="text-xs flex-1"
                  >
                    WebSocket
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {connectionType === 'webrtc' 
                    ? 'Enhanced audio quality with WebRTC' 
                    : 'Standard WebSocket connection'}
                </p>
              </div>
            )}
            
            <Select 
              value={selectedAgent?.id || ""} 
              onValueChange={(value) => {
                const agent = agents.find(a => a.id === value);
                if (agent) setSelectedAgent(agent);
              }} 
              disabled={isCallActive}>
              <SelectTrigger data-testid="select-agent">
                <SelectValue placeholder="Choose an agent to test" />
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

            {selectedAgent && (
              <div className="mt-4 space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Description:</span>
                  <p className="mt-1">
                    {selectedAgent.description || "No description"}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Voice:</span>
                  <p className="mt-1">
                    {selectedAgent.voiceId || "Default voice"}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Call Status */}
          <Card className="p-4 shadow-lg border-0">
            <h3 className="font-semibold mb-3">Call Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {isCallActive ? (
                  <Badge className="bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-700 dark:text-green-300 shadow-sm">
                    <Circle className="w-2 h-2 fill-current mr-1 animate-pulse" />
                    Active
                  </Badge>
                ) : isConnecting ? (
                  <Badge variant="outline">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Connecting
                  </Badge>
                ) : (
                  <Badge variant="outline">Idle</Badge>
                )}
              </div>
              
              {isCallActive && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Audio Level</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-3 rounded-full transition-colors ${
                            audioLevel > (i / 5) ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Notice */}
          <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20 border-amber-500/20 dark:border-amber-400/30 shadow-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Test Environment</p>
                <p className="text-xs text-muted-foreground">
                  This playground uses your EchoSensei API key. Voice calls will consume your API credits.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Voice Call Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-12rem)] flex flex-col shadow-xl border-0 dark:bg-slate-800/50 backdrop-blur">

            {/* Visualization Area */}
            <div className="flex items-center justify-center p-8">
              {/* Show error state if integration is not configured and user can see it */}
              {integrationLoading ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (!integration || integration.error) && !integration?.permissionDenied ? (
                <div className="text-center bg-red-50 dark:bg-red-950 p-8 rounded-lg">
                  <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">API not configured</h3>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {user?.isAdmin || user?.permissions?.includes('manage_integrations')
                      ? "Please add your EchoSensei API key in the Integrations tab"
                      : "EchoSensei API key not configured. Please contact your administrator."}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Circular Visualization */}
                  <div className="relative w-64 h-64 rounded-full flex items-center justify-center">
                    {/* Animated rings when active */}
                    {isCallActive && (
                      <>
                        <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
                        <div className="absolute inset-4 rounded-full border-2 border-primary animate-ping animation-delay-200 opacity-20" />
                        <div className="absolute inset-8 rounded-full border-2 border-primary animate-ping animation-delay-400 opacity-15" />
                      </>
                    )}
                    
                    {/* Static rings */}
                    <div className="absolute inset-0 rounded-full border border-gray-300 dark:border-gray-700" />
                    <div className="absolute inset-4 rounded-full border border-gray-300 dark:border-gray-700" />
                    <div className="absolute inset-8 rounded-full border border-gray-300 dark:border-gray-700" />
                    
                    {/* Center button */}
                    <Button
                      size="lg"
                      variant={isCallActive ? "destructive" : "default"}
                      className={`relative z-10 rounded-full w-32 h-32 transition-all duration-200 hover:scale-105 shadow-2xl ${
                        isConnecting || !selectedAgent ? "opacity-50 cursor-not-allowed" : ""
                      } ${!isCallActive ? "gradient-purple hover:opacity-90" : ""}`}
                      onClick={isCallActive ? endCall : startCall}
                      disabled={isConnecting || !selectedAgent}
                      data-testid="button-call"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : isCallActive ? (
                        <PhoneOff className="w-8 h-8" />
                      ) : (
                        <div className="text-center">
                          <Phone className="w-8 h-8 mx-auto mb-2" />
                          <span className="text-sm font-medium">Try a call</span>
                        </div>
                      )}
                    </Button>
                  </div>

                  {/* Audio level indicator */}
                  {isCallActive && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                      <Activity className="w-6 h-6 text-green-500" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            {isCallActive && (
              <div className="border-t p-4">
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleMute}
                    data-testid="button-mute"
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant={!isSpeakerOn ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleSpeaker}
                    data-testid="button-speaker"
                  >
                    {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div className="border-t flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b bg-gradient-to-r from-muted/30 to-muted/50">
                <h4 className="text-sm font-medium">Call Transcript</h4>
              </div>
              <ScrollArea ref={transcriptScrollRef} className="flex-1 w-full">
                <div className="p-4 space-y-3 w-full overflow-hidden">
                  {transcript.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Transcript will appear here when you start a call
                    </p>
                  ) : (
                    transcript.map((msg, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={msg.role === "assistant" ? "default" : "secondary"} className="text-xs">
                            {msg.role === "assistant" ? "Assistant" : "You"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {msg.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm pl-2 overflow-x-auto max-w-full">
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}