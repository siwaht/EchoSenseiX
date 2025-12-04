import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Upload, Sparkles, Wand2, Settings2 } from "lucide-react";

import { getProvidersByCategory } from "@shared/voice-ai-providers";

const importAgentSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  externalAgentId: z.string().min(1, "Agent ID is required"),
  name: z.string().optional(),
  // Provider selection
  llmProvider: z.string().optional(),
  ttsProvider: z.string().optional(),
  sttProvider: z.string().optional(),
  vadProvider: z.string().optional(),
  telephonyProvider: z.string().optional(),
});

const createAgentSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  name: z.string().min(1, "Agent name is required"),
  firstMessage: z.string().min(1, "First message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  language: z.string().default("en"),
  voiceId: z.string().optional(),
  // Provider selection
  llmProvider: z.string().optional(),
  ttsProvider: z.string().optional(),
  sttProvider: z.string().optional(),
  vadProvider: z.string().optional(),
  telephonyProvider: z.string().optional(),
});

type ImportAgentForm = z.infer<typeof importAgentSchema>;
type CreateAgentForm = z.infer<typeof createAgentSchema>;

interface AddAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgentModal({ open, onOpenChange }: AddAgentModalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validatedData, setValidatedData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptDescription, setPromptDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch configured integrations to show available providers
  useQuery<any[]>({
    queryKey: ["/api/integrations/all"],
  });

  const importForm = useForm<ImportAgentForm>({
    resolver: zodResolver(importAgentSchema),
    defaultValues: {
      platform: "elevenlabs",
      externalAgentId: "",
      name: "",
      llmProvider: "",
      ttsProvider: "",
      sttProvider: "",
      vadProvider: "",
      telephonyProvider: "",
    },
  });

  const createForm = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      platform: "elevenlabs",
      name: "",
      firstMessage: "Hello! How can I assist you today?",
      systemPrompt: "You are a helpful AI assistant.",
      language: "en",
      voiceId: "",
      llmProvider: "",
      ttsProvider: "",
      sttProvider: "",
      vadProvider: "",
      telephonyProvider: "",
    },
  });

  const validateAgentMutation = useMutation({
    mutationFn: async (data: { elevenLabsAgentId: string }) => {
      setIsValidating(true);
      const response = await apiRequest("POST", "/api/agents/validate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setValidatedData(data.agentData);
      importForm.setValue("name", data.agentData.name || "");
      toast({
        title: "Agent Validated",
        description: "Agent found and validated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Validation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsValidating(false);
    },
  });

  const importAgentMutation = useMutation({
    mutationFn: async (data: ImportAgentForm) => {
      await apiRequest("POST", "/api/agents", {
        platform: data.platform,
        externalAgentId: data.externalAgentId,
        // Backward compatibility for ElevenLabs
        elevenLabsAgentId: data.platform === 'elevenlabs' ? data.externalAgentId : undefined,
        name: data.name || validatedData?.name || "Unnamed Agent",
        description: validatedData?.description,
        providers: {
          llm: data.llmProvider || undefined,
          tts: data.ttsProvider || undefined,
          stt: data.sttProvider || undefined,
          vad: data.vadProvider || undefined,
          telephony: data.telephonyProvider || undefined,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent imported successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const response = await apiRequest("POST", "/api/agents/create", {
        ...data,
        providers: {
          llm: data.llmProvider || undefined,
          tts: data.ttsProvider || undefined,
          stt: data.sttProvider || undefined,
          vad: data.vadProvider || undefined,
          telephony: data.telephonyProvider || undefined,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generatePromptMutation = useMutation({
    mutationFn: async (description: string) => {
      setIsGeneratingPrompt(true);
      const response = await apiRequest("POST", "/api/agents/generate-prompt", { description });
      return response.json();
    },
    onSuccess: (data) => {
      createForm.setValue("systemPrompt", data.systemPrompt);
      toast({
        title: "Prompt Generated",
        description: "AI has generated a comprehensive system prompt based on your description",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGeneratingPrompt(false);
    },
  });

  const handleGeneratePrompt = () => {
    if (!promptDescription.trim() || promptDescription.trim().length < 10) {
      toast({
        title: "Description Too Short",
        description: "Please provide a more detailed description (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }
    generatePromptMutation.mutate(promptDescription);
  };

  const handleClose = () => {
    importForm.reset();
    createForm.reset();
    setValidatedData(null);
    setActiveTab("create");
    setPromptDescription("");
    setIsGeneratingPrompt(false);
    onOpenChange(false);
  };

  const onValidate = () => {
    const platform = importForm.getValues("platform");
    const externalAgentId = importForm.getValues("externalAgentId");
    if (!externalAgentId) {
      toast({
        title: "Error",
        description: "Please enter an Agent ID",
        variant: "destructive",
      });
      return;
    }
    // Only validate for ElevenLabs (other platforms would need their own validation)
    if (platform === 'elevenlabs') {
      validateAgentMutation.mutate({ elevenLabsAgentId: externalAgentId });
    } else {
      toast({
        title: "Validation Skipped",
        description: `Validation is only available for ElevenLabs. Proceeding with ${platform} agent import.`,
      });
      setValidatedData({ name: importForm.getValues("name") || "Imported Agent" });
    }
  };

  const onImportSubmit = (data: ImportAgentForm) => {
    if (!validatedData) {
      toast({
        title: "Error",
        description: "Please validate the agent first",
        variant: "destructive",
      });
      return;
    }
    importAgentMutation.mutate(data);
  };

  const onCreateSubmit = (data: CreateAgentForm) => {
    createAgentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle data-testid="text-modal-title" className="text-base sm:text-lg">Add New Agent</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Import Existing</span>
              <span className="sm:hidden">Import</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Create New</span>
              <span className="sm:hidden">Create</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[calc(85vh-200px)] px-1 pb-4">
            <Form {...importForm}>
              <form onSubmit={importForm.handleSubmit(onImportSubmit)} className="space-y-4">
                <FormField
                  control={importForm.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          <SelectItem value="livekit">LiveKit</SelectItem>
                          <SelectItem value="vapi">Vapi</SelectItem>
                          <SelectItem value="retell">Retell AI</SelectItem>
                          <SelectItem value="bland">Bland AI</SelectItem>
                          <SelectItem value="vocode">Vocode</SelectItem>
                          <SelectItem value="deepgram">Deepgram</SelectItem>
                          <SelectItem value="custom">Custom Platform</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which platform hosts this agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={importForm.control}
                  name="externalAgentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent ID</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            {...field}
                            placeholder="Enter Agent ID from platform"
                            disabled={isValidating || importAgentMutation.isPending}
                            data-testid="input-agent-id"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onValidate}
                            disabled={isValidating || !field.value}
                            data-testid="button-validate-agent"
                          >
                            {isValidating ? "Validating..." : "Validate"}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        You can find this in your {importForm.watch('platform') || 'platform'} dashboard
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {validatedData && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200" data-testid="text-validation-success">
                      ✓ Agent validated successfully
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300" data-testid="text-validated-agent-name">
                      Name: {validatedData.name}
                    </p>
                    {validatedData.description && (
                      <p className="text-sm text-green-600 dark:text-green-300" data-testid="text-validated-agent-description">
                        Description: {validatedData.description}
                      </p>
                    )}
                  </div>
                )}

                <FormField
                  control={importForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter a display name"
                          disabled={isValidating || importAgentMutation.isPending}
                          data-testid="input-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Provider Configuration Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-4 h-4" />
                    <h4 className="font-medium text-sm">Provider Configuration (Optional)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select specific providers for each service. Leave blank to use platform defaults.
                  </p>

                  {['llmProvider', 'ttsProvider', 'sttProvider', 'vadProvider', 'telephonyProvider'].map((providerField) => {
                    const category = providerField.replace('Provider', '');
                    const providers = getProvidersByCategory(category as any);
                    const label = category === 'llm' ? 'LLM' : category === 'tts' ? 'TTS' : category === 'stt' ? 'STT' : category === 'vad' ? 'VAD' : 'Telephony';

                    return (
                      <FormField
                        key={providerField}
                        control={importForm.control}
                        name={providerField as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{label} Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={`Select ${label} provider`} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Platform Default</SelectItem>
                                {providers.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id}>
                                    {provider.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 w-full"
                    disabled={isValidating || importAgentMutation.isPending || !validatedData}
                    data-testid="button-import-agent"
                  >
                    {importAgentMutation.isPending ? "Importing..." : "Import Agent"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 w-full"
                    onClick={handleClose}
                    disabled={isValidating || importAgentMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="create" className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[calc(85vh-200px)] px-1 pb-4">
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter agent name"
                          disabled={createAgentMutation.isPending}
                          data-testid="input-create-name"
                        />
                      </FormControl>
                      <FormDescription>
                        Give your agent a descriptive name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="firstMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Message</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Hello! How can I assist you today?"
                          disabled={createAgentMutation.isPending}
                          data-testid="input-first-message"
                        />
                      </FormControl>
                      <FormDescription>
                        The greeting message your agent will use
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        System Prompt
                        <Sparkles className="w-4 h-4 text-purple-500" />
                      </FormLabel>

                      {/* AI Prompt Generator */}
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Wand2 className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                            AI Prompt Generator
                          </span>
                        </div>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                          Describe your desired agent and we'll generate a comprehensive system prompt for you
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., a customer support agent for your business"
                            value={promptDescription}
                            onChange={(e) => setPromptDescription(e.target.value)}
                            disabled={isGeneratingPrompt || createAgentMutation.isPending}
                            className="flex-1 text-xs"
                            data-testid="input-prompt-description"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleGeneratePrompt}
                            disabled={isGeneratingPrompt || !promptDescription.trim() || createAgentMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3"
                            data-testid="button-generate-prompt"
                          >
                            {isGeneratingPrompt ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                <span className="text-xs">Generating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 mr-1" />
                                <span className="text-xs">Generate</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="You are a helpful AI assistant..."
                          disabled={createAgentMutation.isPending || isGeneratingPrompt}
                          data-testid="input-system-prompt"
                          rows={6}
                        />
                      </FormControl>
                      <FormDescription>
                        Define your agent's personality and behavior. Use the AI generator above for assistance.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          <SelectItem value="livekit">LiveKit</SelectItem>
                          <SelectItem value="vapi">Vapi</SelectItem>
                          <SelectItem value="retell">Retell AI</SelectItem>
                          <SelectItem value="bland">Bland AI</SelectItem>
                          <SelectItem value="vocode">Vocode</SelectItem>
                          <SelectItem value="deepgram">Deepgram</SelectItem>
                          <SelectItem value="custom">Custom Platform</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which platform will host this agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="nl">Dutch</SelectItem>
                          <SelectItem value="pl">Polish</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="ko">Korean</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Primary language for the agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Provider Configuration Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-4 h-4" />
                    <h4 className="font-medium text-sm">Provider Configuration (Optional)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select specific providers for each service. Leave blank to use platform defaults.
                  </p>

                  {['llmProvider', 'ttsProvider', 'sttProvider', 'vadProvider', 'telephonyProvider'].map((providerField) => {
                    const category = providerField.replace('Provider', '');
                    const providers = getProvidersByCategory(category as any);
                    const label = category === 'llm' ? 'LLM' : category === 'tts' ? 'TTS' : category === 'stt' ? 'STT' : category === 'vad' ? 'VAD' : 'Telephony';

                    return (
                      <FormField
                        key={providerField}
                        control={createForm.control}
                        name={providerField as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{label} Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={`Select ${label} provider`} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Platform Default</SelectItem>
                                {providers.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id}>
                                    {provider.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 w-full"
                    disabled={createAgentMutation.isPending}
                    data-testid="button-create-agent"
                  >
                    {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 w-full"
                    onClick={handleClose}
                    disabled={createAgentMutation.isPending}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
