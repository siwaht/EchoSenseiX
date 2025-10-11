import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AgentAssignmentProps {
  userId: string;
  onClose?: () => void;
  hideActions?: boolean;  // Hide save/cancel buttons when embedded
  onAssignmentsChange?: (assignedAgentIds: string[]) => void;  // Callback for parent to track changes
}

interface Agent {
  id: string;
  name: string;
  elevenLabsAgentId?: string;
  assigned?: boolean;
}

export function AgentAssignment({ userId, onClose, hideActions = false, onAssignmentsChange }: AgentAssignmentProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [localAssignments, setLocalAssignments] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch agents with assignment status
  const { data: agents = [], isLoading, refetch } = useQuery<Agent[]>({
    queryKey: [`/api/admin/users/${userId}/agents`],
    enabled: !!userId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Initialize local assignments when data loads or userId changes
  useEffect(() => {
    if (agents && agents.length > 0) {
      const assigned = new Set(agents.filter(a => a.assigned).map(a => a.id));
      setLocalAssignments(assigned);
      setHasChanges(false);
    }
  }, [agents, userId]);

  // Mutation for assigning agent
  const assignMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/agents/${agentId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to assign agent");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/agents`] });
    },
  });

  // Mutation for unassigning agent
  const unassignMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/agents/${agentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to unassign agent");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/agents`] });
    },
  });

  const handleToggleAssignment = (agentId: string, checked: boolean) => {
    const newAssignments = new Set(localAssignments);
    if (checked) {
      newAssignments.add(agentId);
    } else {
      newAssignments.delete(agentId);
    }
    setLocalAssignments(newAssignments);
    setHasChanges(true);
    
    // Notify parent of changes if callback provided
    if (onAssignmentsChange) {
      onAssignmentsChange(Array.from(newAssignments));
    }
  };

  const handleSave = async () => {
    const originalAssignments = new Set(agents.filter(a => a.assigned).map(a => a.id));
    const toAssign = Array.from(localAssignments).filter(id => !originalAssignments.has(id));
    const toUnassign = Array.from(originalAssignments).filter(id => !localAssignments.has(id));

    try {
      // Process assignments
      for (const agentId of toAssign) {
        await assignMutation.mutateAsync(agentId);
      }

      // Process unassignments
      for (const agentId of toUnassign) {
        await unassignMutation.mutateAsync(agentId);
      }

      // Invalidate all related queries to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/agents`] }),
        queryClient.invalidateQueries({ queryKey: ['/api/agents'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/users'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/organization'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] })
      ]);

      toast({
        title: "Success",
        description: "Agent assignments updated successfully",
      });

      setHasChanges(false);
      if (onClose) onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agent assignments",
        variant: "destructive",
      });
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.elevenLabsAgentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign Agents</CardTitle>
        <CardDescription>
          Select which agents this user can access and manage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Agent list */}
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-3">
              {filteredAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchTerm ? "No agents found matching your search" : "No agents available"}
                </p>
              ) : (
                filteredAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`agent-${agent.id}`}
                      checked={localAssignments.has(agent.id)}
                      onCheckedChange={(checked) =>
                        handleToggleAssignment(agent.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`agent-${agent.id}`}
                      className="flex-1 cursor-pointer flex items-center gap-2"
                    >
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{agent.name}</span>
                        {agent.elevenLabsAgentId && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({agent.elevenLabsAgentId})
                          </span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Summary */}
          <div className="text-sm text-muted-foreground">
            {localAssignments.size} of {agents.length} agents selected
          </div>

          {/* Actions - only show if not hidden */}
          {!hideActions && (
            <div className="flex justify-end gap-2">
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || assignMutation.isPending || unassignMutation.isPending}
              >
                {assignMutation.isPending || unassignMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Assignments"
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}