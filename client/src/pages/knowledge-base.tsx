import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  BookOpen, 
  Search, 
  Plus, 
  Upload, 
  Brain, 
  FileText, 
  Globe,
  Sparkles,
  RefreshCw,
  Settings,
  Users
} from "lucide-react";
import { KnowledgeBaseManager } from "@/components/knowledge-base/knowledge-base-manager";
import { MultilingualConfig } from "@/components/agents/multilingual-config";

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch knowledge base statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/knowledge-base/stats"],
    queryFn: async () => {
      const response = await fetch("/api/knowledge-base/stats", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch knowledge base stats");
      }
      return response.json();
    },
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6" role="main" aria-label="Knowledge Base Management">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3 brand-gradient-text">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" aria-hidden="true" />
            Knowledge Base
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Manage your AI agent's knowledge, documents, and multilingual capabilities
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] })}
          variant="outline"
          size="sm"
          className="btn-brand-premium w-full sm:w-auto"
          aria-label="Refresh knowledge base data"
        >
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </header>

      {/* Statistics Cards */}
      {!statsLoading && stats && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Knowledge Base Statistics">
          <Card className="card-hover" role="article" aria-label="Total Entries Statistics">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" aria-hidden="true"></div>
                Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold brand-gradient-text" aria-label={`${stats.totalEntries || 0} total entries`}>{stats.totalEntries || 0}</p>
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Knowledge base entries
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover" role="article" aria-label="Languages Statistics">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true"></div>
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" aria-label={`${stats.supportedLanguages || 0} supported languages`}>{stats.supportedLanguages || 0}</p>
                <Globe className="h-5 w-5 text-blue-500" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported languages
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover" role="article" aria-label="Active Agents Statistics">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" aria-hidden="true"></div>
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" aria-label={`${stats.activeAgents || 0} active agents`}>{stats.activeAgents || 0}</p>
                <Brain className="h-5 w-5 text-purple-500" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enhanced with knowledge
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Knowledge</span>
          </TabsTrigger>
          <TabsTrigger value="multilingual" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Languages</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common knowledge base operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start btn-brand-premium"
                  onClick={() => setActiveTab("knowledge")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Knowledge Entry
                </Button>
                <Button
                  className="w-full justify-start btn-brand-premium"
                  onClick={() => setActiveTab("multilingual")}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Configure Languages
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Latest knowledge base updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">New knowledge entry added</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs">
                      Just now
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Agent enhanced with knowledge</span>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 text-xs">
                      1 hour ago
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Integration Status */}
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Integration Status
              </CardTitle>
              <CardDescription>
                ElevenLabs knowledge base integration status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      ElevenLabs Integration Active
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-300">
                      Knowledge base is synced with ElevenLabs
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                  Connected
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Management Tab */}
        <TabsContent value="knowledge" className="space-y-4">
          <KnowledgeBaseManager />
        </TabsContent>

        {/* Multilingual Configuration Tab */}
        <TabsContent value="multilingual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Multilingual Configuration
              </CardTitle>
              <CardDescription>
                Configure languages, first messages, and system prompts for your agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MultilingualConfig agentId="" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
