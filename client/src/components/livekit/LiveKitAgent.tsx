import {
    LiveKitRoom,
    RoomAudioRenderer,
    useLocalParticipant,
    ControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LiveKitAgentProps {
    roomName: string;
    participantName: string;
    className?: string;
    onConnected?: () => void;
    onDisconnected?: () => void;
}

export function LiveKitAgent({
    roomName,
    participantName,
    className,
    onConnected,
    onDisconnected,
}: LiveKitAgentProps) {
    const [token, setToken] = useState<string>("");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        let isMounted = true;

        const fetchToken = async () => {
            try {
                const response = await fetch(
                    `/api/livekit/token?roomName=${encodeURIComponent(
                        roomName
                    )}&participantName=${encodeURIComponent(participantName)}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch token");
                }

                const data = await response.json();
                if (isMounted) {
                    setToken(data.token);
                }
            } catch (err) {
                if (isMounted) {
                    setError("Failed to connect to LiveKit server");
                    console.error(err);
                }
            }
        };

        if (roomName && participantName) {
            fetchToken();
        }

        return () => {
            isMounted = false;
        };
    }, [roomName, participantName]);

    if (error) {
        return (
            <div className="flex items-center justify-center p-4 text-red-500 bg-red-50 rounded-lg">
                {error}
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                    Connecting to LiveKit...
                </span>
            </div>
        );
    }

    return (
        <div className={className}>
            <LiveKitRoom
                video={false}
                audio={true}
                token={token}
                serverUrl={import.meta.env.VITE_LIVEKIT_URL} // Ensure this env var is exposed to client
                data-lk-theme="default"
                style={{ height: "100%" }}
                onConnected={onConnected}
                onDisconnected={onDisconnected}
            >
                {/* Audio renderer for remote participants */}
                <RoomAudioRenderer />

                {/* Controls for the local user */}
                <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-card border">
                    <div className="text-sm font-medium">Connected to {roomName}</div>
                    <ControlBar variation="minimal" controls={{ microphone: true, camera: false, screenShare: false, chat: false }} />
                    <ConnectionStatus />
                </div>
            </LiveKitRoom>
        </div>
    );
}

function ConnectionStatus() {
    const { isMicrophoneEnabled } = useLocalParticipant();

    return (
        <div className="text-xs text-muted-foreground">
            Mic: {isMicrophoneEnabled ? "On" : "Off"}
        </div>
    );
}
