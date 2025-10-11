import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Play,
  Square,
  Plus,
  Trash,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Mic,
  Target,
  TrendingUp,
  MessageSquare
} from "lucide-react";

interface TestScenario {
  id: string;
  name: string;
  description: string;
  expectedBehavior: string;
  testMessages: string[];
  tags: string[];
  createdAt: string;
  lastRun?: string;
  status?: "passed" | "failed" | "running" | "not_run";
}

interface TestResult {
  id: string;
  scenarioId: string;
  runAt: string;
  duration: number;
  status: "passed" | "failed";
  transcript: Array<{
    role: "user" | "agent";
    message: string;
    timestamp: string;
  }>;
  evaluation: {
    score: number;
    criteria: Record<string, boolean>;
    feedback: string;
  };
  audioUrl?: string;
}

export default function AgentTesting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(window.location.search);
  const agentId = params.get("agentId");

  const [activeTab, setActiveTab] = useState("scenarios");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showNewScenario, setShowNewScenario] = useState(false);

  // New scenario form
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [testMessages, setTestMessages] = useState("");
  const [scenarioTags, setScenarioTags] = useState("");

  // Fetch agent
  const { data: agent } = useQuery({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) throw new Error("Failed to fetch agent");
      return response.json();
    },
    enabled: !!agentId,
  });

  // Fetch test scenarios
  const { data: scenarios = [], isLoading: loadingScenarios } = useQuery<TestScenario[]>({
    queryKey: ["/api/testing/scenarios", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/testing/scenarios?agentId=${agentId}`);
      if (!response.ok) throw new Error("Failed to fetch scenarios");
      return response.json();
    },
    enabled: !!agentId,
  });

  // Fetch test results
  const { data: results = [] } = useQuery<TestResult[]>({
    queryKey: ["/api/testing/results", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/testing/results?agentId=${agentId}`);
      if (!response.ok) throw new Error("Failed to fetch results");
      return response.json();
    },
    enabled: !!agentId,
  });

  // Create scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/testing/scenarios", {
        ...data,
        agentId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test scenario created successfully",
      });
      setShowNewScenario(false);
      setScenarioName("");
      setScenarioDescription("");
      setExpectedBehavior("");
      setTestMessages("");
      setScenarioTags("");
      queryClient.invalidateQueries({ queryKey: ["/api/testing/scenarios"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scenario",
        variant: "destructive",
      });
    },
  });

  // Run test mutation
  const runTestMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return apiRequest("POST", `/api/testing/run`, {
        agentId,
        scenarioId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Started",
        description: "Test scenario is now running",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/results"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run test",
        variant: "destructive",
      });
    },
  });

  // Delete scenario mutation
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return apiRequest("DELETE", `/api/testing/scenarios/${scenarioId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test scenario deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/scenarios"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete scenario",
        variant: "destructive",
      });
    },
  });

  const handleCreateScenario = () => {
    const messages = testMessages.split('\n').filter(m => m.trim());
    const tags = scenarioTags.split(',').map(t => t.trim()).filter(t => t);

    createScenarioMutation.mutate({
      name: scenarioName,
      description: scenarioDescription,
      expectedBehavior,
      testMessages: messages,
      tags,
    });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="outline">Not Run</Badge>;
    }
  };

  // Calculate metrics
  const totalTests = scenarios.length;
  const passedTests = scenarios.filter(s => s.status === "passed").length;
  const failedTests = scenarios.filter(s => s.status === "failed").length;
  const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Agent not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/agents")}
          >
            Back to Agents
          </Button>
        </div>
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
            <h1 className="text-2xl font-bold">Agent Testing</h1>
            <p className="text-muted-foreground">Test {agent.name} with scenarios</p>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Tests</p>
              <p className="text-2xl font-bold">{totalTests}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Passed</p>
              <p className="text-2xl font-bold text-green-600">{passedTests}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{failedTests}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pass Rate</p>
              <p className="text-2xl font-bold">{passRate}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Test Scenarios</h2>
            <Button
              onClick={() => setShowNewScenario(!showNewScenario)}
              variant={showNewScenario ? "outline" : "default"}
            >
              <Plus className="h-4 w-4 mr-2" />
              {showNewScenario ? "Cancel" : "New Scenario"}
            </Button>
          </div>

          {/* New Scenario Form */}
          {showNewScenario && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Create Test Scenario</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scenarioName">Scenario Name</Label>
                  <Input
                    id="scenarioName"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g., Customer Support Flow"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="scenarioDescription">Description</Label>
                  <Textarea
                    id="scenarioDescription"
                    value={scenarioDescription}
                    onChange={(e) => setScenarioDescription(e.target.value)}
                    placeholder="Describe what this scenario tests..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label htmlFor="expectedBehavior">Expected Behavior</Label>
                  <Textarea
                    id="expectedBehavior"
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="What should the agent do in this scenario?"
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label htmlFor="testMessages">Test Messages (one per line)</Label>
                  <Textarea
                    id="testMessages"
                    value={testMessages}
                    onChange={(e) => setTestMessages(e.target.value)}
                    placeholder="Hello, I need help with my order&#10;My order number is 12345&#10;Can you check the status?"
                    className="mt-1 min-h-[120px] font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="scenarioTags">Tags (comma-separated)</Label>
                  <Input
                    id="scenarioTags"
                    value={scenarioTags}
                    onChange={(e) => setScenarioTags(e.target.value)}
                    placeholder="e.g., support, critical, regression"
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateScenario}
                    disabled={!scenarioName || !testMessages || createScenarioMutation.isPending}
                  >
                    {createScenarioMutation.isPending ? "Creating..." : "Create Scenario"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewScenario(false);
                      setScenarioName("");
                      setScenarioDescription("");
                      setExpectedBehavior("");
                      setTestMessages("");
                      setScenarioTags("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Scenarios List */}
          <div className="grid gap-4">
            {loadingScenarios ? (
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  Loading scenarios...
                </div>
              </Card>
            ) : scenarios.length === 0 ? (
              <Card className="p-6">
                <div className="text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Test Scenarios</h3>
                  <p className="text-muted-foreground mb-4">
                    Create test scenarios to validate your agent's behavior
                  </p>
                  <Button onClick={() => setShowNewScenario(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Scenario
                  </Button>
                </div>
              </Card>
            ) : (
              scenarios.map((scenario) => (
                <Card key={scenario.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(scenario.status)}
                        <h3 className="font-semibold">{scenario.name}</h3>
                        {getStatusBadge(scenario.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {scenario.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          <MessageSquare className="inline h-3 w-3 mr-1" />
                          {scenario.testMessages.length} messages
                        </span>
                        {scenario.lastRun && (
                          <span>
                            <Clock className="inline h-3 w-3 mr-1" />
                            Last run: {new Date(scenario.lastRun).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {scenario.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {scenario.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => runTestMutation.mutate(scenario.id)}
                        disabled={runTestMutation.isPending || scenario.status === "running"}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedScenario(scenario.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteScenarioMutation.mutate(scenario.id)}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <h2 className="text-lg font-semibold">Test Results</h2>
          
          <div className="grid gap-4">
            {results.length === 0 ? (
              <Card className="p-6">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Test Results</h3>
                  <p className="text-muted-foreground">
                    Run test scenarios to see results here
                  </p>
                </div>
              </Card>
            ) : (
              results.map((result) => {
                const scenario = scenarios.find(s => s.id === result.scenarioId);
                return (
                  <Card key={result.id} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <h3 className="font-semibold">
                            {scenario?.name || "Unknown Scenario"}
                          </h3>
                          {getStatusBadge(result.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(result.runAt).toLocaleString()} • {result.duration}ms
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {result.evaluation.score}%
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>

                    {/* Evaluation Criteria */}
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Evaluation Criteria:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(result.evaluation.criteria).map(([criterion, passed]) => (
                          <div key={criterion} className="flex items-center gap-1 text-sm">
                            {passed ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-500" />
                            )}
                            <span className={passed ? "text-green-700" : "text-red-700"}>
                              {criterion}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feedback */}
                    {result.evaluation.feedback && (
                      <div className="p-3 bg-muted rounded-md mb-4">
                        <p className="text-sm">{result.evaluation.feedback}</p>
                      </div>
                    )}

                    {/* Transcript Preview */}
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium mb-2">
                        View Transcript ({result.transcript.length} messages)
                      </summary>
                      <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                        {result.transcript.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`text-sm p-2 rounded ${
                              msg.role === "user"
                                ? "bg-blue-50 dark:bg-blue-950 ml-8"
                                : "bg-gray-50 dark:bg-gray-900 mr-8"
                            }`}
                          >
                            <p className="font-medium text-xs mb-1">
                              {msg.role === "user" ? "User" : "Agent"}
                            </p>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Audio Recording */}
                    {result.audioUrl && (
                      <div className="mt-4">
                        <audio controls className="w-full">
                          <source src={result.audioUrl} type="audio/mpeg" />
                        </audio>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Test Automation</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Continuous Testing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Run tests automatically on a schedule or when changes are made
                </p>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="schedule">Test Schedule</Label>
                    <Select defaultValue="manual">
                      <SelectTrigger id="schedule" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Only</SelectItem>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="on-change">On Agent Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Run on Deploy</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically run tests before deploying changes
                      </p>
                    </div>
                    <input type="checkbox" className="toggle" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Reports</Label>
                      <p className="text-xs text-muted-foreground">
                        Send test results via email
                      </p>
                    </div>
                    <input type="checkbox" className="toggle" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Regression Testing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically detect when agent behavior changes
                </p>
                <Button variant="outline" className="w-full">
                  Configure Regression Tests
                </Button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">A/B Testing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Compare different agent configurations
                </p>
                <Button variant="outline" className="w-full">
                  Set Up A/B Test
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}