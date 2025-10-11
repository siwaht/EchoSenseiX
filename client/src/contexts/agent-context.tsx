import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@shared/schema";

interface AgentContextType {
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  agents: Agent[];
  isLoading: boolean;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [selectedAgent, setSelectedAgentState] = useState<Agent | null>(null);
  
  // Fetch agents
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Load saved selection from localStorage on mount
  useEffect(() => {
    const savedAgentId = localStorage.getItem("selectedAgentId");
    if (savedAgentId && agents.length > 0) {
      const savedAgent = agents.find(a => a.id === savedAgentId);
      if (savedAgent) {
        setSelectedAgentState(savedAgent);
      }
    }
  }, [agents]);

  // Auto-select single agent and handle agent availability
  useEffect(() => {
    // If there's only one agent, always select it
    if (agents.length === 1) {
      // Select the single agent if nothing is selected or current selection is invalid
      if (!selectedAgent || !agents.find(a => a.id === selectedAgent.id)) {
        setSelectedAgentState(agents[0]);
        localStorage.setItem("selectedAgentId", agents[0].id);
      }
    }
    // Clear selection if the selected agent is no longer available
    else if (selectedAgent && agents.length > 0 && !agents.find(a => a.id === selectedAgent.id)) {
      setSelectedAgentState(null);
      localStorage.removeItem("selectedAgentId");
    }
  }, [agents]);

  // Custom setter that also saves to localStorage
  // Memoize to prevent unnecessary re-renders
  const setSelectedAgent = useCallback((agent: Agent | null) => {
    setSelectedAgentState(agent);
    if (agent) {
      localStorage.setItem("selectedAgentId", agent.id);
    } else {
      localStorage.removeItem("selectedAgentId");
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ selectedAgent, setSelectedAgent, agents, isLoading }),
    [selectedAgent, setSelectedAgent, agents, isLoading]
  );

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error("useAgentContext must be used within an AgentProvider");
  }
  return context;
}