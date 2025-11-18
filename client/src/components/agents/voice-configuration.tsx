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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Mic, Play, Loader2, Save, Plus, Trash2, Volume2, Settings, Users, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const voiceSettingsSchema = z.object({
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

interface VoiceConfigurationProps {
  agentId: string;
  currentVoiceId?: string;
  currentVoiceSettings?: any;
  currentMultiVoiceConfig?: any;
}

export function VoiceConfiguration({ 
  agentId, 
  currentVoiceId = "", 
  currentVoiceSettings = {},
  currentMultiVoiceConfig = {}
}: VoiceConfigurationProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(currentVoiceId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiVoices, setMultiVoices] = useState<any[]>(currentMultiVoiceConfig?.voices || []);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: ["/api/elevenlabs/voices"],
  });

  const form = useForm<VoiceSettingsForm>({
    resolver: zodResolver(voiceSettingsSchema),
    defaultValues: {
      voiceId: currentVoiceId,
      stability: currentVoiceSettings?.stability || 0.5,
      similarityBoost: currentVoiceSettings?.similarityBoost || 0.75,
      style: currentVoiceSettings?.style || 0,
      useSpeakerBoost: currentVoiceSettings?.useSpeakerBoost || true,
      multiVoiceEnabled: currentMultiVoiceConfig?.enabled || false,
      multiVoiceConfig: currentMultiVoiceConfig?.voices || [],
    },
  });

  const saveVoiceSettingsMutation = useMutation({
    mutationFn: async (data: VoiceSettingsForm) => {
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
      const response = await apiRequest("POST", "/api/voiceai/preview", {
        voiceId,
        text,
        stability: form.getValues("stability"),
        similarityBoost: form.getValues("similarityBoost"),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
      }
    },
    onError: () => {
      toast({
        title: "Preview Error",
        description: "Failed to generate voice preview",
        variant: "destructive",
      });
    },
  });

  const addMultiVoice = () => {
    const newVoice = {
      voiceId: "",
      name: "",
      character: "",
      trigger: "",
      stability: 0.5,
      similarityBoost: 0.75,
    };
    setMultiVoices([...multiVoices, newVoice]);
  };

  const removeMultiVoice = (index: number) => {
    setMultiVoices(multiVoices.filter((_, i) => i !== index));
  };

  const updateMultiVoice = (index: number, field: string, value: any) => {
    const updated = [...multiVoices];
    updated[index] = { ...updated[index], [field]: value };
    setMultiVoices(updated);
  };

  const handlePreview = (voiceId: string) => {
    if (!voiceId) return;
    previewVoiceMutation.mutate({
      voiceId,
      text: "Hello! This is a preview of how I will sound.",
    });
  };

  const onSubmit = (data: VoiceSettingsForm) => {
    saveVoiceSettingsMutation.mutate({
      ...data,
      multiVoiceConfig: form.getValues("multiVoiceEnabled") ? multiVoices : [],
    });
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Voice</TabsTrigger>
              <TabsTrigger value="quality">Voice Quality</TabsTrigger>
              <TabsTrigger value="multi">Multi-Voice</TabsTrigger>
            </TabsList>

            {/* Basic Voice Settings */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Voice Selection
                  </CardTitle>
                  <CardDescription>
                    Choose the primary voice for your agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="voiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a voice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {voices && Array.isArray(voices) ? (
                              voices.map((voice: any) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{voice.name}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreview(voice.voice_id);
                                      }}
                                      disabled={previewVoiceMutation.isPending}
                                    >
                                      <Play className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="rachel">Rachel</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose from ElevenLabs' library of natural-sounding voices
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="speaker-boost"
                      checked={form.watch("useSpeakerBoost")}
                      onCheckedChange={(checked) => form.setValue("useSpeakerBoost", checked)}
                    />
                    <Label htmlFor="speaker-boost">Use Speaker Boost</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enhances voice clarity and consistency
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Voice Quality Settings */}
            <TabsContent value="quality" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Voice Quality Settings
                  </CardTitle>
                  <CardDescription>
                    Fine-tune the voice characteristics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="stability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stability</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                              max={1}
                              min={0}
                              step={0.01}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Variable</span>
                              <span className="font-medium">{field.value.toFixed(2)}</span>
                              <span>Stable</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Controls voice consistency. Higher values make the voice more stable but less expressive.
                        </FormDescription>
                        <FormMessage />
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
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                              max={1}
                              min={0}
                              step={0.01}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Different</span>
                              <span className="font-medium">{field.value.toFixed(2)}</span>
                              <span>Similar</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          How closely the generated voice matches the original voice characteristics.
                        </FormDescription>
                        <FormMessage />
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
                          <div className="space-y-2">
                            <Slider
                              value={[field.value || 0]}
                              onValueChange={(value) => field.onChange(value[0])}
                              max={1}
                              min={0}
                              step={0.01}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Natural</span>
                              <span className="font-medium">{(field.value || 0).toFixed(2)}</span>
                              <span>Exaggerated</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Controls how much the voice style is exaggerated.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Multi-Voice Settings */}
            <TabsContent value="multi" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Multi-Voice Configuration
                  </CardTitle>
                  <CardDescription>
                    Set up multiple voices for different scenarios or characters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="multiVoiceEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Multi-Voice</FormLabel>
                          <FormDescription>
                            Allow the agent to use different voices based on context
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("multiVoiceEnabled") && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Additional Voices</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMultiVoice}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Voice
                        </Button>
                      </div>

                      <ScrollArea className="h-64">
                        <div className="space-y-4">
                          {multiVoices.map((voice, index) => (
                            <Card key={index} className="p-4">
                              <div className="flex items-start justify-between mb-4">
                                <h4 className="text-sm font-medium">Voice {index + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMultiVoice(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Voice</Label>
                                  <Select
                                    value={voice.voiceId}
                                    onValueChange={(value) => updateMultiVoice(index, "voiceId", value)}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select voice" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {voices && Array.isArray(voices) ? (
                                        voices.map((v: any) => (
                                          <SelectItem key={v.voice_id} value={v.voice_id}>
                                            {v.name}
                                          </SelectItem>
                                        ))
                                      ) : null}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label>Name</Label>
                                  <Input
                                    value={voice.name}
                                    onChange={(e) => updateMultiVoice(index, "name", e.target.value)}
                                    placeholder="Voice name"
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label>Character/Context</Label>
                                  <Input
                                    value={voice.character || ""}
                                    onChange={(e) => updateMultiVoice(index, "character", e.target.value)}
                                    placeholder="e.g., Customer Service"
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label>Trigger Keywords</Label>
                                  <Input
                                    value={voice.trigger || ""}
                                    onChange={(e) => updateMultiVoice(index, "trigger", e.target.value)}
                                    placeholder="e.g., complaint, support"
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>

                      {multiVoices.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No additional voices configured</p>
                          <p className="text-sm">Click "Add Voice" to create multi-voice scenarios</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveVoiceSettingsMutation.isPending}
              className="btn-brand-premium"
            >
              {saveVoiceSettingsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Voice Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
