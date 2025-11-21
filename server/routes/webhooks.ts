import { Router } from "express";
import {
    handleConversationInitWebhook,
    handlePostCallWebhook,
    handleEventsWebhook
} from "../webhooks/elevenlabs-webhooks";

const router = Router();

// ==========================================
// ElevenLabs Webhook Routes (No Auth Required)
// ==========================================

// Post-call webhook - receives call summary and metadata after call completion
router.post("/elevenlabs/post-call", handlePostCallWebhook);

// Conversation initialization webhook - receives data when conversation starts
router.post("/elevenlabs/conversation-init", handleConversationInitWebhook);

// Events webhook - receives real-time events during conversation
router.post("/elevenlabs/events", handleEventsWebhook);

export default router;
