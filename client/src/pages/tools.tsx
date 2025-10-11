import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Code, Wrench, Webhook,
  ChevronDown, ChevronRight, Settings2, Zap, Hammer,
  CheckCircle, XCircle, Database,
  Brain, FileText, Upload, Search, Phone, Languages,
  SkipForward, UserPlus, Voicemail, Hash, Server,
  Mic, AudioLines, Bot, Key, Shield, ShieldAlert, ShieldOff, Sparkles, Settings,
  Info, RefreshCw, File, PlayCircle, Loader2, UserCheck, Clock, SendHorizontal
} from "lucide-react";
import type { Agent, CustomTool } from "@shared/schema";
import { MCPServerDialog } from "@/components/mcp-server-dialog";
import { WebhookToolDialog } from "@/components/webhook-tool-dialog";

interface WebhookParameter {
  name: string;
  type?: string;
  required?: boolean;
  valueType?: string;
  description?: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  enabled?: boolean;
  type?: 'webhook';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  webhookConfig?: {
    responseTimeout?: number;
    disableInterruptions?: boolean;
    preToolSpeech?: 'auto' | 'force' | 'none';
    authentication?: {
      type?: string;
      credentials?: any;
    };
    headers?: Array<{
      key: string;
      value: string;
      enabled: boolean;
    }>;
    pathParameters?: Array<{
      key: string;
      description?: string;
    }>;
    queryParameters?: Array<{
      key: string;
      description?: string;
      required?: boolean;
      dataType?: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      valueType?: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    bodyParameters?: Array<{
      identifier: string;
      dataType: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      description?: string;
      required?: boolean;
      valueType: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    dynamicVariables?: Record<string, string>;
    dynamicVariableAssignments?: Array<{
      variable: string;
      jsonPath: string;
    }>;
  };
}

interface ToolConfig {
  id: string;
  name: string;
  type: string;
  configuration?: Record<string, any>;
  enabled: boolean;
}


export default function Tools() {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    webhooks: true,
    integrations: false,
    custom: false,
  });
  const [mcpServerDialog, setMcpServerDialog] = useState<{
    isOpen: boolean;
    server?: CustomTool;
  }>({ isOpen: false });
  const [webhookDialog, setWebhookDialog] = useState<{
    isOpen: boolean;
    webhook?: any;
  }>({ isOpen: false });
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);


  // Tool configurations state
  const [toolsConfig, setToolsConfig] = useState({
    conversationInitiationWebhook: {
      enabled: false,
      url: '',
      description: 'Fetch initiation client data from webhook when receiving Twilio or SIP trunk calls',
    },
    postCallWebhook: {
      enabled: false,
      url: '',
      description: 'Override the post-call webhook configured in settings for this agent',
    },
    transferToAgent: {
      enabled: false,
      phoneNumber: '',
      message: '',
      department: '',
      workingHours: '',
      description: 'Transfer call to a human agent when requested',
      requiresApproval: true,
      approvalStatus: 'none' as 'none' | 'pending' | 'approved' | 'rejected',
    },
    webhooks: [] as WebhookConfig[],
    integrations: [] as ToolConfig[],
    customTools: [] as ToolConfig[],
    mcpServers: [] as CustomTool[],
  });

  // Load agent's tools configuration when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      const tools = selectedAgent.tools as any || {};
      const mcpServers = tools.customTools?.filter((t: any) => t.type === 'mcp') || [];
      
      setToolsConfig({
        conversationInitiationWebhook: tools.conversationInitiationWebhook || {
          enabled: false,
          url: '',
          description: 'Fetch initiation client data from webhook when receiving Twilio or SIP trunk calls',
        },
        postCallWebhook: tools.postCallWebhook || {
          enabled: false,
          url: '',
          description: 'Override the post-call webhook configured in settings for this agent',
        },
        transferToAgent: tools.transferToAgent || {
          enabled: false,
          phoneNumber: '',
          message: '',
          department: '',
          workingHours: '',
          description: 'Transfer call to a human agent when requested',
          requiresApproval: true,
          approvalStatus: 'none',
        },
        webhooks: tools.webhooks || [],
        integrations: tools.integrations || [],
        customTools: tools.customTools?.filter((t: any) => t.type !== 'mcp') || [],
        mcpServers: mcpServers,
      });
    }
  }, [selectedAgent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (updates: Partial<Agent>) => {
      if (!selectedAgentId) throw new Error("No agent selected");
      return await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Tools configuration updated successfully" });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update tools configuration", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });


  const handleSave = () => {
    if (!selectedAgentId) {
      toast({ 
        title: "No agent selected", 
        description: "Please select an agent first",
        variant: "destructive" 
      });
      return;
    }

    // Build integrations array
    const integrations = [...toolsConfig.integrations];

    // Build custom tools array
    const customTools = [...toolsConfig.customTools.filter(t => t.type !== 'mcp')];
    
    // Add MCP servers to custom tools
    if (toolsConfig.mcpServers && toolsConfig.mcpServers.length > 0) {
      customTools.push(...toolsConfig.mcpServers.map(server => ({
        ...server,
        configuration: server.configuration || {}
      })));
    }

    updateAgentMutation.mutate({
      tools: {
        conversationInitiationWebhook: toolsConfig.conversationInitiationWebhook,
        postCallWebhook: toolsConfig.postCallWebhook,
        transferToAgent: toolsConfig.transferToAgent,
        webhooks: toolsConfig.webhooks,
        integrations: integrations as any,
        customTools: customTools as any,
        toolIds: [], // Maintain backward compatibility
      } as any,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addWebhook = () => {
    setWebhookDialog({ isOpen: true });
  };

  const updateWebhook = (index: number, updates: Partial<WebhookConfig>) => {
    const updated = [...toolsConfig.webhooks];
    updated[index] = { ...updated[index], ...updates };
    setToolsConfig({ ...toolsConfig, webhooks: updated });
    setHasUnsavedChanges(true);
  };

  const deleteWebhook = (index: number) => {
    setToolsConfig({
      ...toolsConfig,
      webhooks: toolsConfig.webhooks.filter((_, i) => i !== index),
    });
    setHasUnsavedChanges(true);
  };

  // Submit tool for approval
  const submitForApproval = async (toolType: 'transfer' | 'webhook' | 'mcp', toolData: any) => {
    try {
      const response = await apiRequest("POST", "/api/admin/tasks", {
        type: "approval",
        title: `${toolType === 'transfer' ? 'Transfer to Agent' : toolType === 'webhook' ? 'Webhook' : 'MCP'} Configuration Request`,
        description: `Request to ${toolData.enabled ? 'enable' : 'modify'} ${toolType} for agent: ${selectedAgent?.name}`,
        status: "pending",
        priority: "medium",
        relatedEntityType: toolType === 'mcp' ? 'mcp' : toolType === 'webhook' ? 'webhook' : 'agent',
        relatedEntityId: selectedAgentId,
        metadata: {
          agentId: selectedAgentId,
          agentName: selectedAgent?.name,
          toolType,
          toolConfig: toolData,
          userEmail: 'user@example.com', // This should come from user context
          organizationId: selectedAgent?.organizationId,
        },
      });

      toast({
        title: "Submitted for Approval",
        description: `Your ${toolType} configuration has been submitted for admin approval.`,
      });

      // Update local state to show pending status
      if (toolType === 'transfer') {
        setToolsConfig(prev => ({
          ...prev,
          transferToAgent: {
            ...prev.transferToAgent,
            approvalStatus: 'pending',
          }
        }));
      }

      return response;
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit configuration for approval.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const testWebhook = async (webhook: any) => {
    if (!webhook.url) {
      toast({
        title: "Error",
        description: "Webhook URL is required",
        variant: "destructive",
      });
      return;
    }

    setTestingWebhook(webhook.id);
    setTestResults({});

    try {
      // Prepare test data based on webhook method
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        agent_id: selectedAgentId,
        message: "This is a test request from EchoSensei Dashboard",
      };

      const requestOptions: RequestInit = {
        method: webhook.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.webhookConfig?.headers?.reduce((acc: any, header: any) => {
            if (header.key && header.value) {
              acc[header.key] = header.value;
            }
            return acc;
          }, {}) || {}),
        },
      };

      // Add body for POST/PUT/PATCH methods
      if (['POST', 'PUT', 'PATCH'].includes(webhook.method || 'POST')) {
        requestOptions.body = JSON.stringify(testData);
      }

      // For GET requests, add query parameters
      let testUrl = webhook.url;
      if (webhook.method === 'GET') {
        const params = new URLSearchParams();
        params.append('test', 'true');
        params.append('query', 'test query');
        testUrl = `${webhook.url}${webhook.url.includes('?') ? '&' : '?'}${params.toString()}`;
      }

      const response = await fetch(testUrl, {
        ...requestOptions,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        setTestResults({
          ...testResults,
          [webhook.id]: {
            success: true,
            message: `Success (${response.status}): ${typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData}`,
          },
        });
        toast({
          title: "Test Successful",
          description: `Webhook responded with status ${response.status}`,
        });
      } else {
        setTestResults({
          ...testResults,
          [webhook.id]: {
            success: false,
            message: `Error (${response.status}): ${typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData}`,
          },
        });
        toast({
          title: "Test Failed",
          description: `Webhook responded with status ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResults({
        ...testResults,
        [webhook.id]: {
          success: false,
          message: `Connection error: ${errorMessage}`,
        },
      });
      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(null);
    }
  };


  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading tools configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Tools Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure webhooks, integrations, and custom tools for your agents
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={selectedAgentId || ""}
            onValueChange={setSelectedAgentId}
          >
            <SelectTrigger className="flex-1 sm:w-[200px]" data-testid="select-agent">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || !selectedAgentId || updateAgentMutation.isPending}
            data-testid="button-save"
          >
            {updateAgentMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes. Click "Save" to apply them.
          </p>
        </div>
      )}

      {!selectedAgentId ? (
        <Card className="p-8">
          <div className="text-center">
            <Hammer className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
            <p className="text-muted-foreground">
              Choose an agent from the dropdown above to configure its tools
            </p>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="system" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="system" className="gap-2">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">Custom</span>
            </TabsTrigger>
          </TabsList>

          {/* System Tools Tab */}
          <TabsContent value="system" className="space-y-4">
            {/* Platform Webhooks Section */}
            <Card className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Platform Webhooks</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Configure webhook settings for conversation initiation and post-call processing
                </p>
              </div>

              <div className="space-y-3">
                {/* Conversation Initiation Webhook */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Fetch initiation client data from webhook</p>
                      <p className="text-sm text-muted-foreground">
                        If enabled, the conversation initiation client data will be fetched from the webhook defined in the settings when receiving Twilio or SIP trunk calls
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {toolsConfig.conversationInitiationWebhook?.enabled && toolsConfig.conversationInitiationWebhook?.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testWebhook({
                            id: 'conversation-initiation',
                            name: 'Conversation Initiation Webhook',
                            url: toolsConfig.conversationInitiationWebhook.url,
                            method: 'POST',
                            enabled: true,
                          })}
                          disabled={testingWebhook === 'conversation-initiation'}
                          title="Test webhook"
                          data-testid="button-test-conversation-webhook"
                        >
                          {testingWebhook === 'conversation-initiation' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Switch
                        checked={toolsConfig.conversationInitiationWebhook?.enabled || false}
                        onCheckedChange={(checked) => {
                          setToolsConfig({
                            ...toolsConfig,
                            conversationInitiationWebhook: {
                              ...toolsConfig.conversationInitiationWebhook,
                              enabled: checked,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="switch-conversation-initiation-webhook"
                      />
                    </div>
                  </div>
                  {toolsConfig.conversationInitiationWebhook?.enabled && (
                    <Input
                      placeholder="Webhook URL (e.g., https://api.example.com/initiation)"
                      value={toolsConfig.conversationInitiationWebhook?.url || ''}
                      onChange={(e) => {
                        setToolsConfig({
                          ...toolsConfig,
                          conversationInitiationWebhook: {
                            ...toolsConfig.conversationInitiationWebhook,
                            url: e.target.value,
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      className="text-sm"
                      data-testid="input-conversation-initiation-webhook-url"
                    />
                  )}
                  {testResults['conversation-initiation'] && (
                    <div className={`mt-3 p-3 rounded-md text-xs ${
                      testResults['conversation-initiation'].success 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}>
                      <p className="font-medium mb-1">
                        {testResults['conversation-initiation'].success ? '✓ Test Passed' : '✗ Test Failed'}
                      </p>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs opacity-90">
                        {testResults['conversation-initiation'].message}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Transfer to Agent */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Transfer to Agent</p>
                        {toolsConfig.transferToAgent?.approvalStatus === 'pending' && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending Approval
                          </Badge>
                        )}
                        {toolsConfig.transferToAgent?.approvalStatus === 'approved' && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {toolsConfig.transferToAgent?.approvalStatus === 'rejected' && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enable human agent transfer when customers request to speak with a representative
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {toolsConfig.transferToAgent?.enabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => submitForApproval('transfer', toolsConfig.transferToAgent)}
                          disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                          title="Submit for admin approval"
                          data-testid="button-submit-transfer-approval"
                        >
                          <SendHorizontal className="w-4 h-4 mr-1" />
                          Submit for Approval
                        </Button>
                      )}
                      <Switch
                        checked={toolsConfig.transferToAgent?.enabled || false}
                        onCheckedChange={(checked) => {
                          setToolsConfig({
                            ...toolsConfig,
                            transferToAgent: {
                              ...toolsConfig.transferToAgent,
                              enabled: checked,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                        data-testid="switch-transfer-to-agent"
                      />
                    </div>
                  </div>
                  {toolsConfig.transferToAgent?.enabled && (
                    <div className="space-y-3 pl-4">
                      <div>
                        <Label className="text-sm">Transfer Phone Number</Label>
                        <Input
                          placeholder="+1 (555) 123-4567"
                          value={toolsConfig.transferToAgent?.phoneNumber || ''}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              transferToAgent: {
                                ...toolsConfig.transferToAgent,
                                phoneNumber: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                          className="text-sm mt-1"
                          data-testid="input-transfer-phone"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Department/Team</Label>
                        <Input
                          placeholder="e.g., Customer Support, Sales, Technical Support"
                          value={toolsConfig.transferToAgent?.department || ''}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              transferToAgent: {
                                ...toolsConfig.transferToAgent,
                                department: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                          className="text-sm mt-1"
                          data-testid="input-transfer-department"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Working Hours</Label>
                        <Input
                          placeholder="e.g., Mon-Fri 9AM-5PM EST"
                          value={toolsConfig.transferToAgent?.workingHours || ''}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              transferToAgent: {
                                ...toolsConfig.transferToAgent,
                                workingHours: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                          className="text-sm mt-1"
                          data-testid="input-transfer-hours"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Transfer Message</Label>
                        <Textarea
                          placeholder="Message to play before transferring (e.g., 'I'll transfer you to a human agent who can assist you better.')"
                          value={toolsConfig.transferToAgent?.message || ''}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              transferToAgent: {
                                ...toolsConfig.transferToAgent,
                                message: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          disabled={toolsConfig.transferToAgent?.approvalStatus === 'pending'}
                          className="text-sm mt-1"
                          rows={3}
                          data-testid="textarea-transfer-message"
                        />
                      </div>
                      {toolsConfig.transferToAgent?.requiresApproval && (
                        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-blue-800 dark:text-blue-200">
                            Transfer to Agent configuration requires admin approval before it becomes active.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </div>

                {/* Post-Call Webhook */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Post-Call Webhook</p>
                      <p className="text-sm text-muted-foreground">
                        Override the post-call webhook configured in settings for this agent
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {toolsConfig.postCallWebhook?.enabled && toolsConfig.postCallWebhook?.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testWebhook({
                            id: 'post-call',
                            name: 'Post-Call Webhook',
                            url: toolsConfig.postCallWebhook.url,
                            method: 'POST',
                            enabled: true,
                          })}
                          disabled={testingWebhook === 'post-call'}
                          title="Test webhook"
                          data-testid="button-test-postcall-webhook"
                        >
                          {testingWebhook === 'post-call' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Switch
                        checked={toolsConfig.postCallWebhook?.enabled || false}
                        onCheckedChange={(checked) => {
                          setToolsConfig({
                            ...toolsConfig,
                            postCallWebhook: {
                              ...toolsConfig.postCallWebhook,
                              enabled: checked,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="switch-post-call-webhook"
                      />
                    </div>
                  </div>
                  {toolsConfig.postCallWebhook?.enabled && (
                    <div className="space-y-3">
                      <Input
                        placeholder="Webhook URL (e.g., https://api.example.com/post-call)"
                        value={toolsConfig.postCallWebhook?.url || ''}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            postCallWebhook: {
                              ...toolsConfig.postCallWebhook,
                              url: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm"
                        data-testid="input-post-call-webhook-url"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          // Add webhook creation logic here
                          toast({
                            title: "Create Webhook",
                            description: "This will open the webhook creation modal",
                          });
                        }}
                      >
                        Create Webhook
                      </Button>
                    </div>
                  )}
                  {testResults['post-call'] && (
                    <div className={`mt-3 p-3 rounded-md text-xs ${
                      testResults['post-call'].success 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}>
                      <p className="font-medium mb-1">
                        {testResults['post-call'].success ? '✓ Test Passed' : '✗ Test Failed'}
                      </p>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs opacity-90">
                        {testResults['post-call'].message}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Webhooks</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Configure external API endpoints that your agent can trigger
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setWebhookDialog({ isOpen: true })}
                  data-testid="button-add-webhook"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Webhook</span>
                </Button>
              </div>

              {/* Approval Information Alert */}
              <Alert className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Approval Required:</strong> All webhook configurations must be submitted for admin approval before they become active. 
                  Click the "Submit for Approval" button next to each webhook after configuration.
                </AlertDescription>
              </Alert>
              
              {/* Sync Information Alert */}
              {toolsConfig.webhooks.length > 0 && hasUnsavedChanges && (
                <Alert className="mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Important:</strong> Webhooks are only synced to your voice agents when you click "Save" at the top of the page. 
                    Make sure to save your changes to activate the webhooks in your voice agent.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {toolsConfig.webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No webhooks configured</p>
                    <p className="text-sm mt-1">Add a webhook to get started</p>
                  </div>
                ) : (
                  toolsConfig.webhooks.map((webhook, index) => (
                    <div key={webhook.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{webhook.name || 'Unnamed Webhook'}</p>
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                              {webhook.method || 'GET'}
                            </span>
                            {webhook.enabled && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                                Active
                              </span>
                            )}
                            {webhook.approvalStatus === 'pending' && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending Approval
                              </Badge>
                            )}
                            {webhook.approvalStatus === 'approved' && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </div>
                          {webhook.description && (
                            <p className="text-sm text-muted-foreground mt-1">{webhook.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            URL: {webhook.url || 'Not configured'}
                          </p>
                          {webhook.webhookConfig?.responseTimeout && (
                            <p className="text-xs text-muted-foreground">
                              Timeout: {webhook.webhookConfig.responseTimeout}s
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {webhook.approvalStatus !== 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => submitForApproval('webhook', webhook)}
                              title="Submit for admin approval"
                              data-testid={`button-submit-webhook-approval-${index}`}
                            >
                              <SendHorizontal className="w-4 h-4" />
                            </Button>
                          )}
                          <Switch
                            checked={webhook.enabled !== false}
                            onCheckedChange={(checked) => {
                              const updatedWebhooks = [...toolsConfig.webhooks];
                              updatedWebhooks[index] = { ...webhook, enabled: checked };
                              setToolsConfig({
                                ...toolsConfig,
                                webhooks: updatedWebhooks,
                              });
                              setHasUnsavedChanges(true);
                            }}
                            data-testid={`switch-webhook-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => testWebhook(webhook)}
                            disabled={testingWebhook === webhook.id}
                            title="Test webhook"
                            data-testid={`button-test-webhook-${index}`}
                          >
                            {testingWebhook === webhook.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setWebhookDialog({ isOpen: true, webhook })}
                            data-testid={`button-edit-webhook-${index}`}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteWebhook(index)}
                            data-testid={`button-delete-webhook-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {testResults[webhook.id] && (
                        <div className={`mt-3 p-3 rounded-md text-xs ${
                          testResults[webhook.id].success 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                        }`}>
                          <p className="font-medium mb-1">
                            {testResults[webhook.id].success ? '✓ Test Passed' : '✗ Test Failed'}
                          </p>
                          <pre className="whitespace-pre-wrap break-all font-mono text-xs opacity-90">
                            {testResults[webhook.id].message}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Custom Tools Tab */}
          <TabsContent value="custom" className="space-y-4">
            {/* MCP Servers Card */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Server className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">MCP Servers</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect to Model Context Protocol servers for extended capabilities
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setMcpServerDialog({ isOpen: true })}
                  size="sm"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add MCP Server</span>
                </Button>
              </div>

              {/* MCP Servers Information */}
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Model Context Protocol (MCP)</strong> servers enable your agents to connect with external services like Zapier, HubSpot, Gmail, and custom APIs. MCP is an open standard that allows AI models to interact with diverse data sources and tools.
                </AlertDescription>
              </Alert>
              
              {/* Approval Information Alert */}
              <Alert className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Admin Approval Required:</strong> MCP server configurations must be reviewed and approved by an administrator before activation. 
                  Submit each configuration for approval using the "Submit for Approval" button.
                </AlertDescription>
              </Alert>

              {toolsConfig.mcpServers && toolsConfig.mcpServers.length === 0 ? (
                <Card className="p-8 border-dashed">
                  <div className="flex flex-col items-center text-center">
                    <Server className="h-12 w-12 text-muted-foreground mb-3" />
                    <h4 className="font-semibold mb-1">No MCP servers configured</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add an MCP server to extend your agent's capabilities
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setMcpServerDialog({ isOpen: true })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Configure MCP Server
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {toolsConfig.mcpServers?.map((server: CustomTool) => (
                    <Card key={server.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Server className="h-5 w-5 text-purple-500" />
                            <h4 className="font-semibold">{server.name}</h4>
                            <Badge variant={server.enabled ? "default" : "secondary"}>
                              {server.enabled ? "Active" : "Inactive"}
                            </Badge>
                            {server.mcpConfig && (
                              <Badge variant="outline">
                                {server.mcpConfig.serverType === 'sse' ? 'SSE' : 'HTTP'}
                              </Badge>
                            )}
                            {server.approvalStatus === 'pending' && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending Approval
                              </Badge>
                            )}
                            {server.approvalStatus === 'approved' && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {server.description}
                          </p>
                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-muted-foreground">
                              <strong>URL:</strong> {server.url}
                            </p>
                            {server.mcpConfig && (
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  <strong>Approval Mode:</strong>
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {server.mcpConfig.approvalMode === 'always_ask' && (
                                    <>
                                      <Shield className="h-3 w-3 mr-1" />
                                      Always Ask
                                    </>
                                  )}
                                  {server.mcpConfig.approvalMode === 'fine_grained' && (
                                    <>
                                      <ShieldAlert className="h-3 w-3 mr-1" />
                                      Fine-Grained
                                    </>
                                  )}
                                  {server.mcpConfig.approvalMode === 'no_approval' && (
                                    <>
                                      <ShieldOff className="h-3 w-3 mr-1" />
                                      No Approval
                                    </>
                                  )}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {server.approvalStatus !== 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => submitForApproval('mcp', server)}
                              title="Submit for admin approval"
                              data-testid={`button-submit-mcp-approval-${server.id}`}
                            >
                              <SendHorizontal className="w-4 h-4 mr-1" />
                              Submit for Approval
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMcpServerDialog({ 
                              isOpen: true, 
                              server: server 
                            })}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedServers = toolsConfig.mcpServers?.filter(
                                s => s.id !== server.id
                              ) || [];
                              setToolsConfig({
                                ...toolsConfig,
                                mcpServers: updatedServers,
                              });
                              setHasUnsavedChanges(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Quick Start Guide */}
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Quick Start with Popular MCP Servers:</strong>
                  <ul className="mt-2 ml-2 space-y-1 text-sm">
                    <li>• <strong>Zapier MCP:</strong> Connect to 7000+ apps and services</li>
                    <li>• <strong>HubSpot MCP:</strong> CRM integration for sales and marketing</li>
                    <li>• <strong>Gmail MCP:</strong> Email management and automation</li>
                    <li>• <strong>Custom API:</strong> Connect to your own backend services</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </Card>

          </TabsContent>
        </Tabs>
      )}


      {/* MCP Server Dialog */}
      {mcpServerDialog.isOpen && (
        <MCPServerDialog
          isOpen={mcpServerDialog.isOpen}
          onClose={() => setMcpServerDialog({ isOpen: false })}
          tool={mcpServerDialog.server}
          onSave={(server) => {
            const updatedServers = [...(toolsConfig.mcpServers || [])];
            if (mcpServerDialog.server) {
              // Edit existing server
              const index = updatedServers.findIndex(s => s.id === mcpServerDialog.server?.id);
              if (index !== -1) {
                updatedServers[index] = {
                  ...server,
                  id: server.id || '',
                  name: server.name || '',
                  type: server.type || 'mcp',
                  enabled: server.enabled !== undefined ? server.enabled : true
                } as CustomTool;
              }
            } else {
              // Add new server
              updatedServers.push({
                ...server,
                id: server.id || '',
                name: server.name || '',
                type: server.type || 'mcp',
                enabled: server.enabled !== undefined ? server.enabled : true
              } as CustomTool);
            }
            setToolsConfig({
              ...toolsConfig,
              mcpServers: updatedServers,
            });
            setHasUnsavedChanges(true);
            setMcpServerDialog({ isOpen: false });
          }}
        />
      )}

      {/* Webhook Tool Dialog */}
      {webhookDialog.isOpen && (
        <WebhookToolDialog
          isOpen={webhookDialog.isOpen}
          onClose={() => setWebhookDialog({ isOpen: false })}
          webhook={webhookDialog.webhook}
          onSave={(webhook) => {
            const updatedWebhooks = [...(toolsConfig.webhooks || [])];
            if (webhookDialog.webhook) {
              // Edit existing webhook
              const index = updatedWebhooks.findIndex(w => w.id === webhookDialog.webhook?.id);
              if (index !== -1) {
                updatedWebhooks[index] = webhook as any;
              }
            } else {
              // Add new webhook
              updatedWebhooks.push(webhook as any);
            }
            setToolsConfig({
              ...toolsConfig,
              webhooks: updatedWebhooks,
            });
            setHasUnsavedChanges(true);
            setWebhookDialog({ isOpen: false });
          }}
        />
      )}
    </div>
  );
}