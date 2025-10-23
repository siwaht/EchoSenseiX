/**
 * ElevenLabs Webhook Receivers
 * 
 * This file contains webhook endpoints for receiving events from ElevenLabs:
 * - Conversation initiation webhooks
 * - Post-call webhooks
 * - Real-time event webhooks
 * 
 * These endpoints should be registered in your main routes file.
 */

import type { Request, Response } from "express";
import { storage } from "../storage";
import crypto from "crypto";

/**
 * Verify webhook signature (if secret is configured)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return signature === expectedSignature;
}

/**
 * Conversation Initiation Webhook
 * 
 * Called by ElevenLabs when a conversation is about to start.
 * You can return custom client data that will be available during the conversation.
 * 
 * Register this webhook in your agent's platform_settings:
 * conversation_initiation_client_data_webhook: {
 *   enabled: true,
 *   url: "https://your-domain.com/api/webhooks/elevenlabs/conversation-init"
 * }
 */
export async function handleConversationInitWebhook(req: Request, res: Response) {
  try {
    const {
      conversation_id,
      agent_id,
      phone_number,
      metadata,
      timestamp
    } = req.body;

    console.log("📞 Conversation initiation webhook received:", {
      conversation_id,
      agent_id,
      phone_number,
      timestamp: new Date(timestamp || Date.now()).toISOString()
    });

    // Optional: Verify webhook signature
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-elevenlabs-signature"] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature || !verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.error("❌ Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Find the agent to get organization context
    const agents = await storage.getAllAgents();
    const agent = agents.find(a => a.elevenLabsAgentId === agent_id);

    // You can add custom logic here, such as:
    // - Logging the conversation start
    // - Fetching user data based on phone number
    // - Checking business hours
    // - Loading customer history
    // - Setting up analytics tracking

    // Example: Fetch customer data based on phone number
    let customerData = null;
    if (phone_number && agent) {
      // Query your database for customer information
      // customerData = await storage.getCustomerByPhone(phone_number);
    }

    // Return client data that will be available during the conversation
    // This data can be accessed by tools and used in the conversation
    const clientData = {
      conversation_id,
      timestamp: new Date().toISOString(),
      organization_id: agent?.organizationId || null,
      customer_data: customerData,
      // Add any custom data you want to pass to the conversation
      custom_field: "value",
      business_hours: true,
      priority_customer: false
    };

    res.json({
      success: true,
      client_data: clientData
    });
  } catch (error) {
    console.error("❌ Error processing conversation init webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

/**
 * Post-Call Webhook
 * 
 * Called by ElevenLabs after a conversation ends.
 * Contains the full conversation data including transcript, duration, and recording.
 * 
 * Register this webhook in your agent's platform_settings:
 * post_call_webhook: {
 *   enabled: true,
 *   url: "https://your-domain.com/api/webhooks/elevenlabs/post-call"
 * }
 */
export async function handlePostCallWebhook(req: Request, res: Response) {
  let transaction: any = null;
  
  try {
    const {
      conversation_id,
      agent_id,
      call_duration,
      call_duration_seconds,
      transcript,
      recording_url,
      audio_url,
      cost,
      credits_used,
      phone_number,
      call_status,
      end_reason,
      metadata,
      timestamp,
      analysis
    } = req.body;

    console.log("📊 Post-call webhook received:", {
      conversation_id,
      agent_id,
      call_duration_seconds,
      call_status,
      end_reason,
      timestamp: new Date(timestamp || Date.now()).toISOString()
    });

    // Validate required fields
    if (!conversation_id) {
      console.error("❌ Missing required field: conversation_id");
      return res.status(400).json({ error: "Missing conversation_id" });
    }

    // Optional: Verify webhook signature
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-elevenlabs-signature"] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature || !verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.error("❌ Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Find the agent to get organization context
    const agents = await storage.getAllAgents();
    const agent = agents.find(a => a.elevenLabsAgentId === agent_id);

    if (!agent) {
      console.warn(`⚠️ Agent not found for ElevenLabs ID: ${agent_id}`);
      // Still process the webhook even if agent not found locally
      return res.json({ 
        success: true,
        message: "Agent not found locally, webhook processed",
        conversation_id 
      });
    }

    // Calculate cost (ElevenLabs may provide this, or calculate based on duration)
    const calculatedCost = cost || (credits_used ? credits_used * 0.001 : 0);

    // Extract summary from analysis field if available
    let callSummary = null;
    let summaryMetadata = null;
    
    if (analysis) {
      // ElevenLabs provides analysis with summary and other insights
      if (typeof analysis === 'object') {
        callSummary = analysis.summary || analysis.call_summary || analysis.description || null;
        
        // Store the full analysis as metadata
        summaryMetadata = {
          provider: 'elevenlabs',
          model: 'elevenlabs-analysis',
          analysisData: analysis,
          generatedAt: new Date().toISOString()
        };
        
        console.log("📊 Extracted summary from ElevenLabs analysis:", {
          hasSummary: !!callSummary,
          analysisKeys: Object.keys(analysis)
        });
      } else if (typeof analysis === 'string') {
        // If analysis is a string, use it as the summary
        callSummary = analysis;
        summaryMetadata = {
          provider: 'elevenlabs',
          model: 'elevenlabs-analysis',
          generatedAt: new Date().toISOString()
        };
      }
    }

    // Check for existing call log to prevent duplicates
    const existingCallLog = await storage.getCallLogByConversationId(
      agent.organizationId,
      conversation_id
    );

    if (existingCallLog) {
      console.log("📝 Updating existing call log:", conversation_id);
      
      // Update existing call log with new data including summary
      const updateData: any = {
        status: call_status || existingCallLog.status,
        duration: call_duration_seconds || existingCallLog.duration,
        cost: String(calculatedCost),
        transcript: transcript || existingCallLog.transcript,
        audioUrl: recording_url || audio_url || existingCallLog.audioUrl,
        phoneNumber: phone_number || existingCallLog.phoneNumber,
        summary: callSummary || existingCallLog.summary,
        summaryMetadata: summaryMetadata || existingCallLog.summaryMetadata
      };
      
      await storage.updateCallLog(existingCallLog.id, agent.organizationId, updateData);
      
      // If we have a summary from the webhook, update it separately
      if (callSummary && !existingCallLog.summary) {
        console.log("📝 Updating call log with ElevenLabs summary");
        await storage.updateCallLogSummary(
          existingCallLog.id,
          agent.organizationId,
          callSummary,
          'success',
          summaryMetadata
        );
      }
    } else {
      console.log("📝 Creating new call log:", conversation_id);
      
      // Create new call log with atomic operation
      const newCallLog = await storage.createCallLog({
        organizationId: agent.organizationId,
        conversationId: conversation_id,
        agentId: agent.id,
        status: call_status || "completed",
        duration: call_duration_seconds || 0,
        cost: String(calculatedCost),
        transcript: transcript || {},
        audioUrl: recording_url || audio_url || null,
        phoneNumber: phone_number || null,
        elevenLabsCallId: conversation_id,
        summary: callSummary,
        summaryMetadata: summaryMetadata,
        createdAt: timestamp ? new Date(timestamp) : new Date()
      });
      
      // Log if we received a summary from ElevenLabs
      if (callSummary) {
        console.log("✅ Call log created with ElevenLabs summary:", conversation_id);
      }
    }

    console.log("✅ Call log processed successfully:", conversation_id);

    // You can add custom post-call logic here, such as:
    // - Sending follow-up emails
    // - Updating CRM records
    // - Triggering workflows
    // - Sending notifications to team members
    // - Analyzing sentiment
    // - Generating reports

    // Example: Send notification for long calls
    if (call_duration_seconds && call_duration_seconds > 300) {
      console.log("📧 Long call detected, sending notification...");
      // await sendNotification({
      //   type: "long_call",
      //   conversation_id,
      //   duration: call_duration_seconds
      // });
    }

    // Example: Analyze transcript for keywords
    if (transcript && transcript.text) {
      const keywords = ["urgent", "complaint", "cancel", "refund"];
      const foundKeywords = keywords.filter(keyword => 
        transcript.text.toLowerCase().includes(keyword)
      );
      
      if (foundKeywords.length > 0) {
        console.log("🚨 Important keywords detected:", foundKeywords);
        // await flagConversation(conversation_id, foundKeywords);
      }
    }

    res.json({ 
      success: true,
      message: "Post-call data processed successfully"
    });
  } catch (error) {
    console.error("❌ Error processing post-call webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

/**
 * Real-time Events Webhook
 * 
 * Called by ElevenLabs for real-time events during conversations.
 * This can include tool calls, errors, and other events.
 * 
 * Register this webhook in your agent's platform_settings.
 */
export async function handleEventsWebhook(req: Request, res: Response) {
  try {
    const {
      event_type,
      conversation_id,
      agent_id,
      timestamp,
      data
    } = req.body;

    console.log("⚡ Real-time event webhook received:", {
      event_type,
      conversation_id,
      agent_id,
      timestamp: new Date(timestamp || Date.now()).toISOString()
    });

    // Optional: Verify webhook signature
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-elevenlabs-signature"] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature || !verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.error("❌ Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Process different event types
    switch (event_type) {
      case "conversation.started":
        console.log("🎬 Conversation started:", conversation_id);
        // Handle conversation start
        break;

      case "conversation.ended":
        console.log("🏁 Conversation ended:", conversation_id);
        // Handle conversation end
        break;

      case "tool.called":
        console.log("🔧 Tool called:", data?.tool_name);
        // Handle tool execution
        // You can log tool usage, track performance, etc.
        break;

      case "tool.completed":
        console.log("✅ Tool completed:", data?.tool_name);
        // Handle tool completion
        break;

      case "tool.failed":
        console.error("❌ Tool failed:", data?.tool_name, data?.error);
        // Handle tool failure
        // You might want to alert your team or retry
        break;

      case "error":
        console.error("❌ Error event:", data?.error_message);
        // Handle errors
        // You might want to log these for debugging
        break;

      case "agent.interrupted":
        console.log("⏸️ Agent interrupted by user");
        // Handle interruptions
        break;

      case "user.speech.detected":
        console.log("🎤 User speech detected");
        // Handle speech detection
        break;

      case "agent.speech.started":
        console.log("🗣️ Agent started speaking");
        // Handle agent speech
        break;

      case "agent.speech.ended":
        console.log("🔇 Agent finished speaking");
        // Handle agent speech end
        break;

      default:
        console.log("❓ Unknown event type:", event_type);
    }

    res.json({ 
      success: true,
      message: "Event processed successfully"
    });
  } catch (error) {
    console.error("❌ Error processing event webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

/**
 * Generic webhook handler that routes to specific handlers
 */
export async function handleElevenLabsWebhook(req: Request, res: Response) {
  try {
    const webhookType = req.path.split("/").pop();

    switch (webhookType) {
      case "conversation-init":
        return handleConversationInitWebhook(req, res);
      case "post-call":
        return handlePostCallWebhook(req, res);
      case "events":
        return handleEventsWebhook(req, res);
      default:
        console.warn("⚠️ Unknown webhook type:", webhookType);
        return res.status(404).json({ error: "Unknown webhook type" });
    }
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}
