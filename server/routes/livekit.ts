import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";

const router = Router();

// Environment variables validation
const livekitEnvSchema = z.object({
    LIVEKIT_API_KEY: z.string().min(1, "LIVEKIT_API_KEY is required"),
    LIVEKIT_API_SECRET: z.string().min(1, "LIVEKIT_API_SECRET is required"),
    LIVEKIT_URL: z.string().url("LIVEKIT_URL must be a valid URL"),
});

router.get("/token", async (req, res) => {
    try {
        // Validate environment variables
        const env = livekitEnvSchema.parse(process.env);

        const { roomName, participantName } = req.query;

        if (!roomName || typeof roomName !== "string") {
            return res.status(400).json({ error: "roomName is required" });
        }

        if (!participantName || typeof participantName !== "string") {
            return res.status(400).json({ error: "participantName is required" });
        }

        const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
            identity: participantName,
            ttl: "10m",
        });

        at.addGrant({ roomJoin: true, room: roomName });

        const token = await at.toJwt();

        return res.json({ token });
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("LiveKit Environment Error:", error.errors);
            return res.status(500).json({ error: "Server configuration error: Missing LiveKit credentials" });
        }
        console.error("Error generating LiveKit token:", error);
        return res.status(500).json({ error: "Failed to generate token" });
    }
});

export default router;
