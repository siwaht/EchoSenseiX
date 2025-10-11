import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Play, Loader2, Save, Plus, Trash2, Volume2, Settings, Users, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const voiceSettingsSchema = z.object({
  agentId: z.string().min(1, "Please select an agent"),
  voiceId: z.string().min(1, "Please select a voice"),
  stability: z.number().min(0).max(1),
  similarityBoost: z.number().min(0).max(1),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  multiVoiceEnabled: z.boolean(),
  multiVoiceConfig: z.array(z.object({
    voiceId: z.string(),
    name: z.string(),
    character: z.string().optional(),
    trigger: z.string().optional(),
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
  })).optional(),
});

type VoiceSettingsForm = z.infer<typeof voiceSettingsSchema>;

export default function VoiceConfiguration() {
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiVoices, setMultiVoices] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const form = useForm<VoiceSettingsForm>({
    resolver: zodResolver(voiceSettingsSchema),
    defaultValues: {
      agentId: "",
      voiceId: "",
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
      multiVoiceEnabled: false,
      multiVoiceConfig: [],
    },
  });

  const saveVoiceSettingsMutation = useMutation({
    mutationFn: async (data: VoiceSettingsForm) => {
      const agentId = data.agentId;
      const voiceSettings = {
        voiceId: data.voiceId,
        voiceSettings: {
          stability: data.stability,
          similarityBoost: data.similarityBoost,
          style: data.style,
          useSpeakerBoost: data.useSpeakerBoost,
        },
        multiVoiceConfig: data.multiVoiceEnabled ? {
          enabled: true,
          voices: data.multiVoiceConfig,
          defaultVoice: data.voiceId,
          switchingMode: "keyword" as const,
        } : undefined,
      };
      
      await apiRequest("PATCH", `/api/agents/${agentId}`, voiceSettings);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Voice settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const previewVoiceMutation = useMutation({
    mutationFn: async ({ voiceId, text }: { voiceId: string; text: string }) => {
      const response = await apiRequest("POST", "/api/elevenlabs/preview-voice", {
        voiceId,
        text: text || "Hello! This is a preview of how I sound. I'm excited to help you with your voice AI needs.",
      });
      return response;
    },
    onSuccess: (data: any) => {
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VoiceSettingsForm) => {
    if (data.multiVoiceEnabled) {
      data.multiVoiceConfig = multiVoices;
    }
    saveVoiceSettingsMutation.mutate(data);
  };

  const addMultiVoice = () => {
    setMultiVoices([...multiVoices, {
      voiceId: "",
      name: "",
      character: "",
      trigger: "",
      stability: 0.5,
      similarityBoost: 0.75,
    }]);
  };

  const removeMultiVoice = (index: number) => {
    setMultiVoices(multiVoices.filter((_, i) => i !== index));
  };

  const updateMultiVoice = (index: number, field: string, value: any) => {
    const updated = [...multiVoices];
    updated[index] = { ...updated[index], [field]: value };
    setMultiVoices(updated);
  };

  const getVoiceCategories = () => {
    if (!voices) return {};
    
    const categories: Record<string, any[]> = {
      "Professional": [],
      "Conversational": [],
      "Characters": [],
      "Multilingual": [],
      "Custom": [],
    };

    (voices as any[]).forEach(voice => {
      if (voice.labels?.use_case?.includes("conversational")) {
        categories["Conversational"].push(voice);
      } else if (voice.labels?.accent && voice.labels.accent !== "american") {
        categories["Multilingual"].push(voice);
      } else if (voice.category === "cloned") {
        categories["Custom"].push(voice);
      } else if (voice.labels?.description?.includes("character")) {
        categories["Characters"].push(voice);
      } else {
        categories["Professional"].push(voice);
      }
    });

    return categories;
  };

  if (agentsLoading || voicesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const voiceCategories = getVoiceCategories();

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-0">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
          Voice Configuration
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
          Configure voice settings and personalities for your AI agents
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Single Voice
          </TabsTrigger>
          <TabsTrigger value="multi" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Multi-Voice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
              <CardDescription>
                Configure the voice and speech parameters for your agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="agentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Agent</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agent">
                              <SelectValue placeholder="Choose an agent to configure" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agents && Array.isArray(agents) && agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name || "Unnamed Agent"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the agent you want to configure voice settings for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice Selection</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedVoice(value);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-voice">
                              <SelectValue placeholder="Choose a voice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(voiceCategories).map(([category, categoryVoices]) => (
                              categoryVoices.length > 0 && (
                                <div key={category}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                    {category}
                                  </div>
                                  {categoryVoices.map((voice: any) => (
                                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                      <div className="flex items-center gap-2">
                                        <span>{voice.name}</span>
                                        {(voice.labels as any)?.gender && (
                                          <Badge variant="outline" className="text-xs">
                                            {(voice.labels as any).gender}
                                          </Badge>
                                        )}
                                        {(voice.labels as any)?.accent && (
                                          <Badge variant="outline" className="text-xs">
                                            {(voice.labels as any).accent}
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </div>
                              )
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the voice for your agent
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedVoice && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => previewVoiceMutation.mutate({ voiceId: selectedVoice, text: "" })}
                        disabled={previewVoiceMutation.isPending || isPlaying}
                        data-testid="button-preview-voice"
                      >
                        {previewVoiceMutation.isPending || isPlaying ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Preview Voice
                      </Button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="stability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stability</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[field.value]}
                                onValueChange={([value]) => field.onChange(value)}
                                className="flex-1"
                                data-testid="slider-stability"
                              />
                              <span className="w-12 text-sm text-muted-foreground">
                                {field.value.toFixed(2)}
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Lower values make speech more expressive and variable, higher values make it more stable
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="similarityBoost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Similarity Boost</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[field.value]}
                                onValueChange={([value]) => field.onChange(value)}
                                className="flex-1"
                                data-testid="slider-similarity"
                              />
                              <span className="w-12 text-sm text-muted-foreground">
                                {field.value.toFixed(2)}
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Higher values make the voice more similar to the original voice sample
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Style Exaggeration</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[field.value || 0]}
                                onValueChange={([value]) => field.onChange(value)}
                                className="flex-1"
                                data-testid="slider-style"
                              />
                              <span className="w-12 text-sm text-muted-foreground">
                                {(field.value || 0).toFixed(2)}
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Higher values make the voice style more pronounced (for supported voices)
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="useSpeakerBoost"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Speaker Boost</FormLabel>
                            <FormDescription>
                              Enhance voice clarity and quality
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-speaker-boost"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={saveVoiceSettingsMutation.isPending}
                    className="w-full"
                    data-testid="button-save-settings"
                  >
                    {saveVoiceSettingsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Voice Settings
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multi">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Voice Configuration</CardTitle>
              <CardDescription>
                Configure multiple voices for different characters or scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="multiVoiceEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Multi-Voice</FormLabel>
                          <FormDescription>
                            Allow your agent to switch between multiple voices
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-multi-voice"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                {form.watch("multiVoiceEnabled") && (
                  <>
                    <div className="flex justify-between items-center">
                      <Label>Voice Characters</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMultiVoice}
                        data-testid="button-add-voice"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Voice
                      </Button>
                    </div>

                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div className="space-y-4">
                        {multiVoices.map((voice, index) => (
                          <Card key={index} className="p-4">
                            <div className="space-y-4">
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-medium">Voice {index + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMultiVoice(index)}
                                  data-testid={`button-remove-voice-${index}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Character Name</Label>
                                  <Input
                                    placeholder="e.g., Assistant"
                                    value={voice.name}
                                    onChange={(e) => updateMultiVoice(index, "name", e.target.value)}
                                    data-testid={`input-character-name-${index}`}
                                  />
                                </div>

                                <div>
                                  <Label>Trigger Keyword</Label>
                                  <Input
                                    placeholder="e.g., @assistant"
                                    value={voice.trigger}
                                    onChange={(e) => updateMultiVoice(index, "trigger", e.target.value)}
                                    data-testid={`input-trigger-${index}`}
                                  />
                                </div>
                              </div>

                              <div>
                                <Label>Voice</Label>
                                <Select
                                  value={voice.voiceId}
                                  onValueChange={(value) => updateMultiVoice(index, "voiceId", value)}
                                >
                                  <SelectTrigger data-testid={`select-multi-voice-${index}`}>
                                    <SelectValue placeholder="Choose a voice" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {voices && Array.isArray(voices) && voices.map((v) => (
                                      <SelectItem key={v.voice_id} value={v.voice_id}>
                                        {v.name || "Unnamed Voice"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Character Description</Label>
                                <Textarea
                                  placeholder="Describe this character's personality and role..."
                                  value={voice.character}
                                  onChange={(e) => updateMultiVoice(index, "character", e.target.value)}
                                  rows={2}
                                  data-testid={`textarea-character-${index}`}
                                />
                              </div>
                            </div>
                          </Card>
                        ))}

                        {multiVoices.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No voice characters added yet. Click "Add Voice" to get started.
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {multiVoices.length > 0 && (
                      <Button
                        type="button"
                        onClick={() => {
                          form.setValue("multiVoiceConfig", multiVoices);
                          form.handleSubmit(onSubmit)();
                        }}
                        disabled={saveVoiceSettingsMutation.isPending}
                        className="w-full"
                        data-testid="button-save-multi-voice"
                      >
                        {saveVoiceSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Multi-Voice Configuration
                      </Button>
                    )}
                  </>
                )}
                </div>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}