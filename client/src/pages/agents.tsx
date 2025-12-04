import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Trash2, RefreshCw, Settings, FlaskConical, Sparkles } from "lucide-react";
import { AddAgentModal } from "@/components/modals/add-agent-modal";
import { AgentDetailModal } from "@/components/modals/agent-detail-modal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const [, setLocation] = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete agent");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agent Removed",
        description: "The agent has been successfully removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
      setAgentToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Remove Agent",
        description: error.message || "Could not remove the agent. Please try again.",
        variant: "destructive",
      });
      setAgentToDelete(null);
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/agents/sync", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync agents");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.syncedCount} agents (${data.createdCount} new, ${data.updatedCount} updated)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync agents with the voice service",
        variant: "destructive",
      });
    },
  });

  const getStatusText = (isActive: boolean) => {
    return isActive ? "Active" : "Inactive";
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400" data-testid="text-page-title">
              Voice Agents
            </h2>
            <p className="text-muted-foreground text-lg" data-testid="text-page-description">
              Manage and monitor your conversational AI assistants
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => syncMutation.mutate()}
              variant="outline"
              disabled={syncMutation.isPending}
              className="w-full sm:w-auto border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
              data-testid="button-sync-agents"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Agents'}
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto btn-brand-premium shadow-lg shadow-primary/20"
              data-testid="button-add-agent"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Agent
            </Button>
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!agents || agents.length === 0 ? (
            <Card className="col-span-full p-16 border-dashed border-2 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-primary/5">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold" data-testid="text-no-agents-title">
                    No agents configured
                  </h3>
                  <p className="text-muted-foreground max-w-lg mx-auto text-lg" data-testid="text-no-agents-description">
                    Get started by creating your first voice agent to handle conversations automatically.
                  </p>
                </div>

                <Button onClick={() => setShowAddModal(true)} data-testid="button-add-first-agent" size="lg" className="btn-brand-premium px-8">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create First Agent
                </Button>
              </div>
            </Card>
          ) : (
            agents.map((agent) => (
              <Card
                key={agent.id}
                className="group relative flex flex-col h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-primary/50 hover:-translate-y-1"
                onClick={() => setSelectedAgent(agent)}
              >
                {/* Card Header Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                      <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <Badge className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      agent.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                    )} data-testid={`badge-status-${agent.id}`}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-2 inline-block", agent.isActive ? "bg-emerald-500" : "bg-yellow-500")} />
                      {getStatusText(agent.isActive)}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors" data-testid={`text-agent-name-${agent.id}`}>
                      {agent.name}
                    </h3>

                    {agent.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed" data-testid={`text-agent-description-${agent.id}`}>
                        {agent.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                      <span>Agent ID</span>
                      <code className="font-mono font-medium text-primary/80">{agent.externalAgentId?.slice(0, 8)}...</code>
                    </div>

                    {agent.providers && Object.keys(agent.providers).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.providers.llm && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            {agent.providers.llm}
                          </Badge>
                        )}
                        {agent.providers.tts && (
                          <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                            {agent.providers.tts}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/agents/${agent.id}`);
                    }}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 btn-brand-premium"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/agent-testing?agentId=${agent.id}`);
                    }}
                  >
                    <FlaskConical className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAgentToDelete(agent);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <AddAgentModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
        />

        <AgentDetailModal
          agent={selectedAgent}
          open={!!selectedAgent}
          onOpenChange={(open) => !open && setSelectedAgent(null)}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{agentToDelete?.name}</strong>?
                This action cannot be undone. Call logs associated with this agent will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => agentToDelete && deleteMutation.mutate(agentToDelete.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? "Removing..." : "Remove Agent"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
