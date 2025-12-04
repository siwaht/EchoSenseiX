import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
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
  Settings
} from "lucide-react";
import { KnowledgeBaseManager } from "@/components/knowledge-base/knowledge-base-manager";
import { DocumentUpload } from "@/components/knowledge-base/document-upload";
import { MultilingualConfig } from "@/components/agents/multilingual-config";

export default function KnowledgeBase() {
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 brand-gradient-text">
            <BookOpen className="h-8 w-8 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI agent's knowledge, documents, and multilingual capabilities
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] })}
          variant="outline"
          size="sm"
          className="btn-brand-premium"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold brand-gradient-text">{stats.totalEntries || 0}</p>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Knowledge base entries
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalDocuments || 0}</p>
                <Upload className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded documents
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.supportedLanguages || 0}</p>
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported languages
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.activeAgents || 0}</p>
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enhanced with knowledge
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Knowledge</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
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
                  onClick={() => setActiveTab("documents")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
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
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">Document uploaded</span>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100 text-xs">
                      5 min ago
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

        {/* Document Upload Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Document Upload
              </CardTitle>
              <CardDescription>
                Upload documents to automatically extract knowledge and enhance your agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload />
            </CardContent>
          </Card>
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
