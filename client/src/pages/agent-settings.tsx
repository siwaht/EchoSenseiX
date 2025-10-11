import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Save, 
  Play, 
  MessageSquare, 
  Mic, 
  Brain,
  Sparkles,
  Globe,
  Shield,
  Settings,
  Variable,
  Clock,
  Users
} from "lucide-react";
import type { Agent, User } from "@shared/schema";
import { MultilingualConfig } from "@/components/agents/multilingual-config";
import { KnowledgeBaseManager } from "@/components/knowledge-base/knowledge-base-manager";

export default function AgentSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  
  // Get agentId from URL params or query params
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = params.id || urlParams.get("agentId");
  
  const [activeTab, setActiveTab] = useState("chat");
  const [hasChanges, setHasChanges] = useState(false);
  
  // Get current user to check permissions
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
  
  // Form states
  const [name, setName] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptGenerator, setPromptGenerator] = useState("");
  const [language, setLanguage] = useState("en");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState("150");
  
  // Enhanced prompt fields
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [guardrails, setGuardrails] = useState("");
  const [responseGuidelines, setResponseGuidelines] = useState("");
  
  // Turn-taking settings
  const [turnTimeout, setTurnTimeout] = useState([7]);
  const [silenceTimeout, setSilenceTimeout] = useState([-1]);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState([0.5]);
  
  // Privacy settings
  const [recordVoice, setRecordVoice] = useState(true);
  const [retentionDays, setRetentionDays] = useState(-1);
  const [zeroRetention, setZeroRetention] = useState(false);
  
  // Authentication settings
  const [enableAuth, setEnableAuth] = useState(false);
  const [allowedNumbers, setAllowedNumbers] = useState("");
  
  // Dynamic variables
  const [dynamicVariables, setDynamicVariables] = useState<Record<string, string>>({});
  
  // Evaluation criteria
  const [evaluationEnabled, setEvaluationEnabled] = useState(false);
  const [evaluationCriteria, setEvaluationCriteria] = useState("");
  
  // Multi-voice configuration
  const [multiVoiceEnabled, setMultiVoiceEnabled] = useState(false);
  const [voiceSwitchingMode, setVoiceSwitchingMode] = useState<"keyword" | "character" | "manual">("keyword");
  const [voiceProfiles, setVoiceProfiles] = useState<Array<{
    voiceId: string;
    name: string;
    character?: string;
    description?: string;
    triggerKeywords?: string[];
    triggerCondition?: string;
    stability?: number;
    similarityBoost?: number;
  }>>([{ voiceId: "", name: "", description: "" }]);
  const [defaultVoice, setDefaultVoice] = useState("");
  
  // Helper functions for multi-voice
  const addVoiceProfile = () => {
    setVoiceProfiles([...voiceProfiles, { voiceId: "", name: "", description: "" }]);
    setHasChanges(true);
  };
  
  const removeVoiceProfile = (index: number) => {
    setVoiceProfiles(voiceProfiles.filter((_, i) => i !== index));
    setHasChanges(true);
  };
  
  const updateVoiceProfile = (index: number, field: string, value: any) => {
    const updated = [...voiceProfiles];
    updated[index] = { ...updated[index], [field]: value };
    setVoiceProfiles(updated);
    setHasChanges(true);
  };
  
  // Check if user has advanced settings permission
  const hasAdvancedSettingsPermission = user?.isAdmin || user?.permissions?.includes("advanced_agent_settings");
  
  const { data: agent, isLoading, isError } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Agent not found or access denied");
        }
        throw new Error("Failed to fetch agent");
      }
      return response.json();
    },
    enabled: !!agentId,
  });

  const { data: voices } = useQuery({
    queryKey: ["/api/voiceai/voices"],
    enabled: activeTab === "voice",
  });

  // Load agent data into form
  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setFirstMessage(agent.firstMessage || "");
      setSystemPrompt(agent.systemPrompt || "");
      setLanguage(agent.language || "en");
      setSelectedVoice(agent.voiceId || "");
      if (agent.voiceSettings) {
        setStability([agent.voiceSettings.stability || 0.5]);
        setSimilarityBoost([agent.voiceSettings.similarityBoost || 0.75]);
      }
      if (agent.llmSettings) {
        setModel(agent.llmSettings.model || "gpt-4o-mini");
        setTemperature([agent.llmSettings.temperature || 0.7]);
        setMaxTokens(agent.llmSettings.maxTokens?.toString() || "150");
      }
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest("PATCH", `/api/agents/${agentId}/settings`, settings);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent settings synced successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync settings",
        variant: "destructive",
      });
    },
  });

  const generatePrompt = () => {
    if (!promptGenerator.trim()) {
      toast({
        title: "Error",
        description: "Please describe your agent first",
        variant: "destructive",
      });
      return;
    }
    
    // Generate a comprehensive prompt based on description
    const generatedPrompt = `You are an expert ${promptGenerator}. Your role is to provide helpful, accurate, and professional assistance. You should:

1. Be knowledgeable and informative in your domain
2. Communicate clearly and concisely
3. Be friendly and approachable
4. Ask clarifying questions when needed
5. Provide actionable advice and solutions

Always maintain a professional yet conversational tone, and ensure all responses are helpful and relevant to the user's needs.`;
    
    setSystemPrompt(generatedPrompt);
    setHasChanges(true);
    toast({
      title: "Prompt Generated",
      description: "System prompt has been generated based on your description",
    });
  };

  const handleSave = () => {
    const settings = {
      name,
      firstMessage,
      systemPrompt,
      language,
      voiceId: selectedVoice,
      voiceSettings: {
        stability: stability[0],
        similarity_boost: similarityBoost[0],
      },
      llmSettings: {
        model,
        temperature: temperature[0],
        maxTokens: parseInt(maxTokens),
      },
      turnTaking: {
        turnTimeout: turnTimeout[0],
        silenceTimeout: silenceTimeout[0],
        interruptionSensitivity: interruptionSensitivity[0],
      },
      privacy: {
        recordVoice,
        retentionDays,
        zeroRetention,
      },
      authentication: {
        enabled: enableAuth,
        allowedNumbers: allowedNumbers.split('\n').filter(n => n.trim()),
      },
      dynamicVariables,
      evaluation: {
        enabled: evaluationEnabled,
        criteria: evaluationCriteria.split('\n').filter(c => c.trim()),
      },
      multiVoiceConfig: multiVoiceEnabled ? {
        enabled: multiVoiceEnabled,
        voices: voiceProfiles.filter(p => p.voiceId),
        defaultVoice,
        switchingMode: voiceSwitchingMode,
      } : undefined,
    };
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Unable to Load Agent</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isError ? "You don't have permission to access this agent or it doesn't exist." : "Agent not found"}
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation("/agents")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/agents")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agent Settings</h1>
            <p className="text-muted-foreground">Configure {agent.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/playground?agentId=${agentId}`)}
          >
            <Play className="h-4 w-4 mr-2" />
            Test Agent
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Syncing..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Warning about sync status */}
      {agent.elevenLabsAgentId ? (
        <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ✓ This agent is synced with the voice service. All changes will be updated in real-time.
          </p>
        </Card>
      ) : (
        <Card className="p-4 mb-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ This agent is not synced with the voice service. Run sync from the Agents page first.
          </p>
        </Card>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 mb-4">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden md:inline">Voice</span>
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden md:inline">LLM</span>
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden md:inline">Language</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline">Knowledge</span>
          </TabsTrigger>
          <TabsTrigger 
            value="turntaking" 
            className="flex items-center gap-2"
            disabled={!hasAdvancedSettingsPermission}
            title={!hasAdvancedSettingsPermission ? "Admin approval required" : ""}
          >
            <Clock className="h-4 w-4" />
            <span className="hidden md:inline">Turn-taking</span>
            {!hasAdvancedSettingsPermission && <span className="text-xs">🔒</span>}
          </TabsTrigger>
        </TabsList>
        
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger 
            value="privacy" 
            className="flex items-center gap-2"
            disabled={!hasAdvancedSettingsPermission}
            title={!hasAdvancedSettingsPermission ? "Admin approval required" : ""}
          >
            <Shield className="h-4 w-4" />
            <span className="hidden md:inline">Privacy</span>
            {!hasAdvancedSettingsPermission && <span className="text-xs">🔒</span>}
          </TabsTrigger>
          <TabsTrigger 
            value="variables" 
            className="flex items-center gap-2"
            disabled={!hasAdvancedSettingsPermission}
            title={!hasAdvancedSettingsPermission ? "Admin approval required" : ""}
          >
            <Variable className="h-4 w-4" />
            <span className="hidden md:inline">Variables</span>
            {!hasAdvancedSettingsPermission && <span className="text-xs">🔒</span>}
          </TabsTrigger>
          <TabsTrigger 
            value="advanced" 
            className="flex items-center gap-2"
            disabled={!hasAdvancedSettingsPermission}
            title={!hasAdvancedSettingsPermission ? "Admin approval required" : ""}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">Advanced</span>
            {!hasAdvancedSettingsPermission && <span className="text-xs">🔒</span>}
          </TabsTrigger>
          <TabsTrigger value="multivoice" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Multi-Voice</span>
          </TabsTrigger>
        </TabsList>

        {/* Chat Settings */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Conversation Settings</h2>
            
            <div className="space-y-4">
              {/* Agent Name */}
              <div>
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Enter agent name"
                  className="mt-2"
                />
              </div>

              {/* First Message */}
              <div>
                <Label htmlFor="firstMessage">First Message</Label>
                <Textarea
                  id="firstMessage"
                  value={firstMessage}
                  onChange={(e) => {
                    setFirstMessage(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="What should the agent say when the conversation starts?"
                  className="mt-2 min-h-[80px]"
                />
              </div>

              <Separator />

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Badge variant="outline">Core behavior definition</Badge>
                </div>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Define your agent's behavior, personality, and instructions..."
                  className="mt-2 min-h-[200px] font-mono text-sm"
                />
              </div>

              {/* Enhanced Prompt Fields */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium">Structured Configuration</h3>
                
                {/* Personality */}
                <div>
                  <Label htmlFor="personality">Personality Traits</Label>
                  <Textarea
                    id="personality"
                    value={personality}
                    onChange={(e) => {
                      setPersonality(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., Friendly, professional, empathetic, knowledgeable..."
                    className="mt-2 min-h-[60px]"
                  />
                </div>

                {/* Tone */}
                <div>
                  <Label htmlFor="tone">Communication Tone</Label>
                  <Textarea
                    id="tone"
                    value={tone}
                    onChange={(e) => {
                      setTone(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., Warm and conversational, formal and respectful..."
                    className="mt-2 min-h-[60px]"
                  />
                </div>

                {/* Guardrails */}
                <div>
                  <Label htmlFor="guardrails">Safety Guardrails</Label>
                  <Textarea
                    id="guardrails"
                    value={guardrails}
                    onChange={(e) => {
                      setGuardrails(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., Never share personal information, avoid medical advice..."
                    className="mt-2 min-h-[60px]"
                  />
                </div>

                {/* Response Guidelines */}
                <div>
                  <Label htmlFor="responseGuidelines">Response Guidelines</Label>
                  <Textarea
                    id="responseGuidelines"
                    value={responseGuidelines}
                    onChange={(e) => {
                      setResponseGuidelines(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="e.g., Keep responses concise, always offer next steps..."
                    className="mt-2 min-h-[60px]"
                  />
                </div>
              </div>

              {/* AI Prompt Generator */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">AI Prompt Generator</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Describe your agent and we'll generate a comprehensive system prompt
                </p>
                <div className="flex gap-2">
                  <Input
                    value={promptGenerator}
                    onChange={(e) => setPromptGenerator(e.target.value)}
                    placeholder="e.g., customer support agent for a tech company"
                    onKeyDown={(e) => e.key === "Enter" && generatePrompt()}
                  />
                  <Button onClick={generatePrompt}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Voice Settings */}
        <TabsContent value="voice" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Voice Configuration</h2>
            
            <div className="space-y-6">
              {/* Voice Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Voice Selection</h3>
                <div>
                  <Label htmlFor="voice">Voice</Label>
                  <Select 
                    value={selectedVoice} 
                    onValueChange={(value) => {
                      setSelectedVoice(value);
                      setHasChanges(true);
                    }}
                  >
                    <SelectTrigger id="voice" className="mt-2">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices && Array.isArray(voices) ? (
                        voices.map((voice: any) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>
                            {voice.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="rachel">Rachel</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose from ElevenLabs' library of natural-sounding voices
                  </p>
                </div>
              </div>

              <Separator />

              {/* Voice Quality Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Voice Quality</h3>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Stability</Label>
                    <span className="text-sm text-muted-foreground">{stability[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={stability}
                    onValueChange={(value) => {
                      setStability(value);
                      setHasChanges(true);
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher = more consistent tone, Lower = more expressive variation
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">{similarityBoost[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={similarityBoost}
                    onValueChange={(value) => {
                      setSimilarityBoost(value);
                      setHasChanges(true);
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher = closer to original voice character
                  </p>
                </div>
              </div>

              <Separator />

              {/* Advanced Voice Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Optimization Settings</h3>
                
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Latency Optimization</p>
                      <p className="text-xs text-muted-foreground">Automatically enabled for real-time conversations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Voice Quality</p>
                      <p className="text-xs text-muted-foreground">Using optimized models for natural speech synthesis</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Streaming</p>
                      <p className="text-xs text-muted-foreground">Real-time audio streaming for seamless conversations</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* LLM Settings */}
        <TabsContent value="llm" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Language Model Settings</h2>
            
            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <Label htmlFor="model">Model</Label>
                <Select 
                  value={model} 
                  onValueChange={(value) => {
                    setModel(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger id="model" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Google Models - Newest First */}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Google</div>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Latest)</SelectItem>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    
                    {/* OpenAI Models */}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">OpenAI</div>
                    <SelectItem value="gpt-4.1">GPT-4.1 (Latest)</SelectItem>
                    <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                    <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    
                    {/* Anthropic Models */}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Anthropic</div>
                    <SelectItem value="claude-sonnet-4">Claude Sonnet 4 (Latest)</SelectItem>
                    <SelectItem value="claude-3.7-sonnet">Claude 3.7 Sonnet</SelectItem>
                    <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="claude-3.5-sonnet-v1">Claude 3.5 Sonnet v1</SelectItem>
                    <SelectItem value="claude-3.0-haiku">Claude 3.0 Haiku</SelectItem>
                    
                    {/* ElevenLabs Experimental Models */}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">ElevenLabs (Experimental)</div>
                    <SelectItem value="gpt-oss-120b">GPT-OSS-120B</SelectItem>
                    <SelectItem value="gpt-oss-20b">GPT-OSS-20B</SelectItem>
                    <SelectItem value="qwen3-30b-a3b">Qwen3-30B-A3B</SelectItem>
                    
                    {/* Custom Models */}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Other</div>
                    <SelectItem value="custom">Custom Model (via server)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Temperature */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">{temperature[0]}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={(value) => {
                    setTemperature(value);
                    setHasChanges(true);
                  }}
                  min={0}
                  max={2}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controls randomness. Lower = more focused, Higher = more creative
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <Label htmlFor="maxTokens">Max Response Length (tokens)</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => {
                    setMaxTokens(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="150"
                  className="mt-2"
                  min="50"
                  max="4000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum length of each response (1 token ≈ 4 characters)
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Language Settings */}
        <TabsContent value="language" className="space-y-6">
          <MultilingualConfig agentId={agentId || ""} />
        </TabsContent>

        {/* Knowledge Base Settings */}
        <TabsContent value="knowledge" className="space-y-6">
          <KnowledgeBaseManager />
        </TabsContent>

        {/* Turn-taking Settings */}
        <TabsContent value="turntaking" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Turn-taking & Conversation Flow</h2>
            
            <div className="space-y-6">
              {/* Core Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Response Timing</h3>
                
                {/* Turn Timeout */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Turn Timeout (seconds)</Label>
                    <span className="text-sm text-muted-foreground">{turnTimeout[0]}s</span>
                  </div>
                  <Slider
                    value={turnTimeout}
                    onValueChange={(value) => {
                      setTurnTimeout(value);
                      setHasChanges(true);
                    }}
                    min={1}
                    max={30}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum time to wait for user response before timing out
                  </p>
                </div>

                {/* Silence Timeout */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Silence End Call Timeout</Label>
                    <span className="text-sm text-muted-foreground">
                      {silenceTimeout[0] === -1 ? "Disabled" : `${silenceTimeout[0]}s`}
                    </span>
                  </div>
                  <Slider
                    value={silenceTimeout}
                    onValueChange={(value) => {
                      setSilenceTimeout(value);
                      setHasChanges(true);
                    }}
                    min={-1}
                    max={60}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    End call after X seconds of silence (-1 to disable)
                  </p>
                </div>
              </div>

              <Separator />

              {/* Interruption Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Interruption Handling</h3>
                
                {/* Interruption Sensitivity */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Interruption Sensitivity</Label>
                    <span className="text-sm text-muted-foreground">{interruptionSensitivity[0]}</span>
                  </div>
                  <Slider
                    value={interruptionSensitivity}
                    onValueChange={(value) => {
                      setInterruptionSensitivity(value);
                      setHasChanges(true);
                    }}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How easily the agent can be interrupted (0 = hard, 1 = easy)
                  </p>
                </div>
              </div>

              <Separator />

              {/* Advanced Turn-taking */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Advanced Configuration</h3>
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Additional turn-taking options like backchanneling, overlap handling, and custom speech detection thresholds can be configured through the ElevenLabs API directly.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Privacy & Compliance</h2>
            
            <div className="space-y-6">
              {/* Data Recording Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Data Recording</h3>
                
                {/* Record Voice */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Record Voice Conversations</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Store audio recordings of conversations for analytics
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={recordVoice}
                    onChange={(e) => {
                      setRecordVoice(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="toggle"
                  />
                </div>

                {/* Zero Retention Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Zero Retention Mode</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Delete all conversation data immediately after call ends
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={zeroRetention}
                    onChange={(e) => {
                      setZeroRetention(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="toggle"
                  />
                </div>

                {/* Retention Days */}
                <div>
                  <Label htmlFor="retentionDays">Data Retention Period (days)</Label>
                  <Input
                    id="retentionDays"
                    type="number"
                    value={retentionDays}
                    onChange={(e) => {
                      setRetentionDays(parseInt(e.target.value));
                      setHasChanges(true);
                    }}
                    placeholder="-1"
                    className="mt-2"
                    min="-1"
                    max="365"
                  disabled={zeroRetention}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How long to retain data (-1 for indefinite)
                </p>
              </div>
            </div>

            <Separator />

            {/* Authentication Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Access Control</h3>
              
              {/* Enable Authentication */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Authentication</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only allow authorized users to interact with agent
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enableAuth}
                  onChange={(e) => {
                    setEnableAuth(e.target.checked);
                    setHasChanges(true);
                  }}
                  className="toggle"
                />
              </div>

              {/* Allowed Numbers */}
              {enableAuth && (
                <div>
                  <Label htmlFor="allowedNumbers">Authorized Phone Numbers</Label>
                  <Textarea
                    id="allowedNumbers"
                    value={allowedNumbers}
                    onChange={(e) => {
                      setAllowedNumbers(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="+1234567890&#10;+0987654321&#10;One number per line"
                    className="mt-2 min-h-[100px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter one phone number per line (with country code)
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Compliance Information */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Compliance Notes</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Ensure compliance with local privacy regulations (GDPR, CCPA, etc.)</li>
                <li>• Inform users about data recording when applicable</li>
                <li>• Implement appropriate consent mechanisms for your use case</li>
                <li>• Review ElevenLabs' privacy policy and terms of service</li>
              </ul>
            </div>
          </div>
        </Card>
      </TabsContent>

        {/* Dynamic Variables */}
        <TabsContent value="variables" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Dynamic Variables</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Define variables that can be dynamically set per conversation
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                {Object.entries(dynamicVariables).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input
                      value={key}
                      placeholder="Variable name"
                      className="flex-1"
                      disabled
                    />
                    <Input
                      value={value}
                      placeholder="Default value"
                      className="flex-1"
                      onChange={(e) => {
                        setDynamicVariables({
                          ...dynamicVariables,
                          [key]: e.target.value,
                        });
                        setHasChanges(true);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newVars = { ...dynamicVariables };
                        delete newVars[key];
                        setDynamicVariables(newVars);
                        setHasChanges(true);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                onClick={() => {
                  const varName = prompt("Enter variable name:");
                  if (varName && !dynamicVariables[varName]) {
                    setDynamicVariables({
                      ...dynamicVariables,
                      [varName]: "",
                    });
                    setHasChanges(true);
                  }
                }}
              >
                Add Variable
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Advanced Configuration</h2>
            
            <div className="space-y-6">
              {/* Integration Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Integration Options</h3>
                
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Function Calling</p>
                      <p className="text-xs text-muted-foreground">Connect your agent to external APIs and services</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Custom LLM Server</p>
                      <p className="text-xs text-muted-foreground">Use your own language model server endpoint</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="text-sm font-medium">Webhook Events</p>
                      <p className="text-xs text-muted-foreground">Receive real-time event notifications</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Tuning */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Performance Tuning</h3>
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Advanced performance options like custom timeout settings, concurrency limits, and resource optimization can be configured through the ElevenLabs API directly or contact support for enterprise configurations.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Evaluation Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Quality Assurance</h3>
                
                {/* Enable Evaluation */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Quality Evaluation</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track and evaluate conversation quality metrics
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={evaluationEnabled}
                    onChange={(e) => {
                      setEvaluationEnabled(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="toggle"
                  />
                </div>

                {/* Evaluation Criteria */}
                {evaluationEnabled && (
                  <div>
                    <Label htmlFor="evaluationCriteria">Evaluation Criteria</Label>
                    <Textarea
                      id="evaluationCriteria"
                      value={evaluationCriteria}
                      onChange={(e) => {
                        setEvaluationCriteria(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Enter evaluation criteria, one per line:&#10;• Customer satisfaction&#10;• Issue resolution&#10;• Response accuracy&#10;• Conversation flow"
                      className="mt-2 min-h-[120px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Define criteria to measure agent performance
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Multi-Voice Settings */}
        <TabsContent value="multivoice" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Multi-Voice Configuration</h2>
            
            <div className="space-y-6">
              {/* Enable Multi-Voice */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Multi-Voice Support</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow your agent to dynamically switch between different voices during conversations
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={multiVoiceEnabled}
                  onChange={(e) => {
                    setMultiVoiceEnabled(e.target.checked);
                    setHasChanges(true);
                  }}
                  className="toggle"
                />
              </div>

              {multiVoiceEnabled && (
                <>
                  <Separator />

                  {/* Voice Switching Mode */}
                  <div>
                    <Label htmlFor="switchingMode">Voice Switching Mode</Label>
                    <Select 
                      value={voiceSwitchingMode} 
                      onValueChange={(value) => {
                        setVoiceSwitchingMode(value as "keyword" | "character" | "manual");
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger id="switchingMode" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Keyword-based Switching</SelectItem>
                        <SelectItem value="character">Character-based (Story Mode)</SelectItem>
                        <SelectItem value="manual">Manual Control via API</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose how the agent switches between voices
                    </p>
                  </div>

                  <Separator />

                  {/* Voice Profiles */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Voice Profiles</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addVoiceProfile}
                      >
                        Add Voice
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {voiceProfiles.map((profile, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 space-y-3">
                              {/* Voice Selection */}
                              <div>
                                <Label>Voice {index + 1}</Label>
                                <Select 
                                  value={profile.voiceId} 
                                  onValueChange={(value) => updateVoiceProfile(index, "voiceId", value)}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select a voice" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {voices && Array.isArray(voices) ? (
                                      voices.map((voice: any) => (
                                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                          {voice.name}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="rachel">Rachel</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Character Name (for story mode) */}
                              {voiceSwitchingMode === "character" && (
                                <div>
                                  <Label>Character Name</Label>
                                  <Input
                                    value={profile.character || ""}
                                    onChange={(e) => updateVoiceProfile(index, "character", e.target.value)}
                                    placeholder="e.g., Narrator, Hero, Villain"
                                    className="mt-1"
                                  />
                                </div>
                              )}

                              {/* Trigger Keywords (for keyword mode) */}
                              {voiceSwitchingMode === "keyword" && (
                                <div>
                                  <Label>Trigger Keywords</Label>
                                  <Input
                                    value={profile.triggerKeywords?.join(", ") || ""}
                                    onChange={(e) => updateVoiceProfile(
                                      index, 
                                      "triggerKeywords", 
                                      e.target.value.split(",").map(k => k.trim()).filter(k => k)
                                    )}
                                    placeholder="e.g., technical, sales, support (comma-separated)"
                                    className="mt-1"
                                  />
                                </div>
                              )}

                              {/* Description */}
                              <div>
                                <Label>Description</Label>
                                <Input
                                  value={profile.description || ""}
                                  onChange={(e) => updateVoiceProfile(index, "description", e.target.value)}
                                  placeholder="When should this voice be used?"
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            {/* Remove Button */}
                            {voiceProfiles.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeVoiceProfile(index)}
                                className="ml-2"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Default Voice */}
                  <div>
                    <Label htmlFor="defaultVoice">Default Voice</Label>
                    <Select 
                      value={defaultVoice} 
                      onValueChange={(value) => {
                        setDefaultVoice(value);
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger id="defaultVoice" className="mt-2">
                        <SelectValue placeholder="Select default voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {voiceProfiles.map((profile, index) => (
                          profile.voiceId && (
                            <SelectItem key={index} value={profile.voiceId}>
                              {profile.character || profile.description || `Voice ${index + 1}`}
                            </SelectItem>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      The voice to use when no specific trigger is matched
                    </p>
                  </div>
                </>
              )}

              {/* Multi-Voice Examples */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Use Cases</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• <strong>Story Telling:</strong> Different voices for narrator and characters</p>
                  <p>• <strong>Role-based Support:</strong> Technical vs sales vs customer service voices</p>
                  <p>• <strong>Language Detection:</strong> Switch voices based on detected language</p>
                  <p>• <strong>Emotional Context:</strong> Adapt voice tone based on conversation mood</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}