/**
 * Knowledge Base Service
 * 
 * Integrates with ElevenLabs Agents Platform to provide knowledge base functionality
 * Uses ElevenLabs' conversational AI capabilities for intelligent knowledge retrieval
 */

import { storage } from "../storage";
import { createElevenLabsClient } from "./elevenlabs";

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseQuery {
  query: string;
  category?: string;
  tags?: string[];
  maxResults?: number;
}

export interface KnowledgeBaseResponse {
  answer: string;
  sources: KnowledgeBaseEntry[];
  confidence: number;
  followUpQuestions?: string[];
}

export class KnowledgeBaseService {
  /**
   * Search knowledge base using natural language queries
   */
  static async searchKnowledgeBase(
    organizationId: string, 
    query: KnowledgeBaseQuery
  ): Promise<KnowledgeBaseResponse> {
    try {
      console.log(`[KNOWLEDGE-BASE] Searching for: "${query.query}"`);
      
      // Get ElevenLabs integration
      const integration = await storage.getIntegration(organizationId, "elevenlabs");
      if (!integration || !integration.apiKey) {
        throw new Error("ElevenLabs integration not configured");
      }

      const client = createElevenLabsClient(integration.apiKey);
      
      // Enhanced system prompt for knowledge base queries
      const knowledgeBasePrompt = `
You are an intelligent knowledge base assistant. Your role is to:
1. Analyze the user's query and extract key concepts
2. Search through the available knowledge base entries
3. Provide accurate, helpful answers based on the available information
4. Cite sources when providing information
5. Suggest follow-up questions when appropriate

Available knowledge base entries:
${await this.getKnowledgeBaseEntries(organizationId, query)}

User Query: "${query.query}"

Please provide a comprehensive answer based on the available information. If you cannot find relevant information, clearly state this and suggest alternative queries.
      `;

      // Use ElevenLabs' text-to-dialogue capability for knowledge base queries
      const response = await client.textToDialogue({
        text: knowledgeBasePrompt,
        voice_id: "default", // Use a professional voice for knowledge base responses
        model_id: "eleven_multilingual_v2" // Use multilingual model for better understanding
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to process knowledge base query");
      }

      // Parse the response to extract answer and sources
      const knowledgeResponse = this.parseKnowledgeResponse(response.data);
      
      console.log(`[KNOWLEDGE-BASE] Found ${knowledgeResponse.sources.length} relevant sources`);
      
      return knowledgeResponse;
      
    } catch (error: any) {
      console.error(`[KNOWLEDGE-BASE] Search failed:`, error);
      throw new Error(`Knowledge base search failed: ${error.message}`);
    }
  }

  /**
   * Add knowledge base entry
   */
  static async addKnowledgeEntry(
    organizationId: string,
    entry: Omit<KnowledgeBaseEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<KnowledgeBaseEntry> {
    try {
      console.log(`[KNOWLEDGE-BASE] Adding entry: "${entry.title}"`);
      
      // Store in database (you'll need to add this to your schema)
      const newEntry: KnowledgeBaseEntry = {
        id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // TODO: Implement database storage
      // await storage.createKnowledgeEntry(organizationId, newEntry);
      
      console.log(`[KNOWLEDGE-BASE] Entry added with ID: ${newEntry.id}`);
      return newEntry;
      
    } catch (error: any) {
      console.error(`[KNOWLEDGE-BASE] Failed to add entry:`, error);
      throw new Error(`Failed to add knowledge entry: ${error.message}`);
    }
  }

  /**
   * Update knowledge base entry
   */
  static async updateKnowledgeEntry(
    organizationId: string,
    entryId: string,
    updates: Partial<KnowledgeBaseEntry>
  ): Promise<KnowledgeBaseEntry> {
    try {
      console.log(`[KNOWLEDGE-BASE] Updating entry: ${entryId}`);
      
      // TODO: Implement database update
      // const updatedEntry = await storage.updateKnowledgeEntry(organizationId, entryId, updates);
      
      console.log(`[KNOWLEDGE-BASE] Entry updated: ${entryId}`);
      return updatedEntry;
      
    } catch (error: any) {
      console.error(`[KNOWLEDGE-BASE] Failed to update entry:`, error);
      throw new Error(`Failed to update knowledge entry: ${error.message}`);
    }
  }

  /**
   * Get knowledge base entries for search context
   */
  private static async getKnowledgeBaseEntries(
    organizationId: string,
    query: KnowledgeBaseQuery
  ): Promise<string> {
    try {
      // TODO: Implement database query to get relevant entries
      // const entries = await storage.getKnowledgeEntries(organizationId, {
      //   category: query.category,
      //   tags: query.tags,
      //   search: query.query
      // });

      // For now, return a placeholder
      return `
Sample Knowledge Base Entry 1:
Title: "Voice Agent Best Practices"
Content: "When creating voice agents, ensure you use clear, concise prompts and test with various user scenarios."
Category: "Best Practices"
Tags: ["voice", "agents", "prompts"]

Sample Knowledge Base Entry 2:
Title: "ElevenLabs API Integration"
Content: "The ElevenLabs API supports multiple voice models including Eleven v3, Multilingual v2, and Flash v2.5."
Category: "Technical"
Tags: ["api", "integration", "models"]
      `;
    } catch (error) {
      console.error(`[KNOWLEDGE-BASE] Failed to get entries:`, error);
      return "No knowledge base entries available.";
    }
  }

  /**
   * Parse knowledge base response from ElevenLabs
   */
  private static parseKnowledgeResponse(response: any): KnowledgeBaseResponse {
    try {
      // Extract answer from response
      const answer = response.text || response.content || "I found some relevant information, but I need to process it further.";
      
      // For now, return mock sources - in real implementation, this would parse actual sources
      const sources: KnowledgeBaseEntry[] = [
        {
          id: "sample_1",
          title: "Sample Knowledge Entry",
          content: "This is a sample knowledge base entry that would contain relevant information.",
          category: "General",
          tags: ["sample"],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      return {
        answer,
        sources,
        confidence: 0.8,
        followUpQuestions: [
          "Can you provide more details about this?",
          "Are there any related topics I should know about?",
          "How can I apply this information?"
        ]
      };
    } catch (error) {
      console.error(`[KNOWLEDGE-BASE] Failed to parse response:`, error);
      return {
        answer: "I encountered an error processing your query. Please try rephrasing your question.",
        sources: [],
        confidence: 0.0
      };
    }
  }

  /**
   * Enhance agent with knowledge base capabilities
   */
  static async enhanceAgentWithKnowledgeBase(
    organizationId: string,
    agentId: string,
    knowledgeBaseId?: string
  ): Promise<void> {
    try {
      console.log(`[KNOWLEDGE-BASE] Enhancing agent ${agentId} with knowledge base`);
      
      // Get the agent
      const agent = await storage.getAgent(agentId, organizationId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      // Enhanced system prompt with knowledge base capabilities
      const enhancedPrompt = `
${agent.systemPrompt || ""}

KNOWLEDGE BASE INTEGRATION:
You now have access to an intelligent knowledge base. When users ask questions:

1. First, determine if the question relates to your knowledge base
2. If yes, search for relevant information using natural language understanding
3. Provide accurate answers based on the knowledge base content
4. Cite sources when referencing specific information
5. If you cannot find relevant information, clearly state this and offer to help with related topics

Available knowledge base categories:
- Technical Documentation
- Best Practices
- Troubleshooting
- Product Information
- User Guides

Always be helpful, accurate, and transparent about the source of your information.
      `;

      // Update agent with enhanced prompt
      await storage.updateAgent(agentId, organizationId, {
        systemPrompt: enhancedPrompt,
        lastSynced: new Date()
      });

      console.log(`[KNOWLEDGE-BASE] Agent ${agentId} enhanced with knowledge base capabilities`);
      
    } catch (error: any) {
      console.error(`[KNOWLEDGE-BASE] Failed to enhance agent:`, error);
      throw new Error(`Failed to enhance agent with knowledge base: ${error.message}`);
    }
  }
}

export default KnowledgeBaseService;
