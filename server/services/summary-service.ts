import { Mistral } from '@mistralai/mistralai';
import type { CallLog } from '@shared/schema';

interface SummaryMetadata {
  provider: string;
  model: string;
  tokens?: number;
  cost?: number;
  promptVersion?: string;
}

interface SummaryResult {
  summary: string;
  status: 'success' | 'failed';
  metadata: SummaryMetadata;
  error?: string;
}

class SummaryService {
  private client: Mistral;
  private model = 'mistral-tiny'; // Fast and cost-efficient model

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }
    this.client = new Mistral({ apiKey });
  }

  /**
   * Generate a structured summary of a call log using Mistral AI
   */
  async generateCallSummary(callLog: CallLog): Promise<SummaryResult> {
    try {
      // Validate that we have a transcript to summarize
      if (!callLog.transcript) {
        return {
          summary: '',
          status: 'failed',
          metadata: {
            provider: 'mistral',
            model: this.model,
            promptVersion: '1.0',
          },
          error: 'No transcript available for summarization',
        };
      }

      // Extract and optimize conversation turns
      const conversationTurns = this.extractConversationTurns(callLog.transcript);
      
      if (conversationTurns.length === 0) {
        return {
          summary: '',
          status: 'failed',
          metadata: {
            provider: 'mistral',
            model: this.model,
            promptVersion: '1.0',
          },
          error: 'No valid conversation turns found in transcript',
        };
      }

      // Optimize tokens: use first 3 + last 2 conversation turns
      const optimizedTurns = this.optimizeConversationTurns(conversationTurns);
      
      // Build the conversation text for the prompt
      const conversationText = optimizedTurns
        .map(turn => `${turn.role === 'agent' ? 'Agent' : 'Customer'}: ${turn.message}`)
        .join('\n');

      // Create the prompt for Mistral
      const prompt = this.buildSummaryPrompt(conversationText);

      console.log('[SUMMARY-SERVICE] Generating summary for call:', callLog.id);

      // Call Mistral API
      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent summaries
        maxTokens: 500, // Limit response length
      });

      // Extract the summary from the response
      const content = response.choices?.[0]?.message?.content;
      const summaryText = typeof content === 'string' ? content : '';
      
      if (!summaryText) {
        return {
          summary: '',
          status: 'failed',
          metadata: {
            provider: 'mistral',
            model: this.model,
            promptVersion: '1.0',
          },
          error: 'Empty response from Mistral API',
        };
      }

      // Calculate cost (approximate, adjust based on Mistral pricing)
      const inputTokens = response.usage?.promptTokens || 0;
      const outputTokens = response.usage?.completionTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      // Mistral Tiny pricing (approximate): $0.00025 per 1K tokens
      const estimatedCost = (totalTokens / 1000) * 0.00025;

      console.log('[SUMMARY-SERVICE] Summary generated successfully:', {
        callId: callLog.id,
        tokens: totalTokens,
        cost: estimatedCost,
      });

      return {
        summary: summaryText.trim(),
        status: 'success',
        metadata: {
          provider: 'mistral',
          model: this.model,
          tokens: totalTokens,
          cost: estimatedCost,
          promptVersion: '1.0',
        },
      };
    } catch (error: any) {
      console.error('[SUMMARY-SERVICE] Error generating summary:', error);
      
      return {
        summary: '',
        status: 'failed',
        metadata: {
          provider: 'mistral',
          model: this.model,
          promptVersion: '1.0',
        },
        error: error.message || 'Unknown error occurred during summary generation',
      };
    }
  }

  /**
   * Extract conversation turns from transcript
   */
  private extractConversationTurns(transcript: any): Array<{ role: string; message: string; time?: number }> {
    try {
      let turns: any[] = [];

      // Handle different transcript formats
      if (Array.isArray(transcript)) {
        turns = transcript;
      } else if (typeof transcript === 'string') {
        try {
          const parsed = JSON.parse(transcript);
          if (Array.isArray(parsed)) {
            turns = parsed;
          }
        } catch {
          // If parsing fails, treat as single message
          return [{ role: 'system', message: transcript }];
        }
      } else if (typeof transcript === 'object' && transcript !== null) {
        turns = Object.values(transcript);
      }

      // Filter out tool calls and empty messages, keep only actual conversation
      const conversationTurns = turns
        .filter((turn: any) => {
          // Skip tool calls and empty messages
          if (!turn || !turn.message || !turn.message.trim()) {
            return false;
          }
          // Skip tool-related messages
          if (turn.role === 'tool' || turn.message.includes('[Tool Call]')) {
            return false;
          }
          return true;
        })
        .map((turn: any) => ({
          role: turn.role || 'unknown',
          message: turn.message.trim(),
          time: turn.time_in_call_secs,
        }));

      // Sort by time to maintain conversation order
      conversationTurns.sort((a, b) => (a.time || 0) - (b.time || 0));

      return conversationTurns;
    } catch (error) {
      console.error('[SUMMARY-SERVICE] Error extracting conversation turns:', error);
      return [];
    }
  }

  /**
   * Optimize conversation turns to reduce token usage
   * Use first 3 + last 2 turns
   */
  private optimizeConversationTurns(
    turns: Array<{ role: string; message: string; time?: number }>
  ): Array<{ role: string; message: string; time?: number }> {
    if (turns.length <= 5) {
      return turns;
    }

    // Take first 3 turns
    const firstTurns = turns.slice(0, 3);
    // Take last 2 turns
    const lastTurns = turns.slice(-2);

    // Combine with a marker indicating conversation was truncated
    return [...firstTurns, ...lastTurns];
  }

  /**
   * Build the prompt for Mistral AI
   */
  private buildSummaryPrompt(conversationText: string): string {
    return `You are analyzing a phone conversation between an AI agent and a customer. Based on the following conversation, provide a structured summary that is professional and customer-friendly.

Conversation:
${conversationText}

Please provide a concise summary in the following format:

**Caller Intent:** [What the customer wanted to accomplish in 1-2 sentences]

**Key Topics:** [Main discussion points, separated by commas]

**Action Items:** [Next steps, solutions offered, or information provided by the agent. Focus on what was done to help the customer]

IMPORTANT TONE GUIDELINES:
- Use neutral, factual language
- Focus on what was discussed and offered, not on problems or failures
- Frame everything positively or neutrally
- Example: Instead of "issue was not resolved" → "agent offered alternatives and solutions"
- Example: Instead of "customer was frustrated" → "agent provided options to address the request"

Keep the summary professional, concise, and helpful. Show the agent in a positive light by focusing on the assistance and solutions provided.`;
  }
}

// Export singleton instance
export default new SummaryService();
