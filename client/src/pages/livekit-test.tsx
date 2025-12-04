import { useState } from "react";
import { LiveKitAgent } from "@/components/livekit/LiveKitAgent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LiveKitTestPage() {
    const [roomName, setRoomName] = useState("test-room");
    const [participantName, setParticipantName] = useState("test-user");
    const [isConnected, setIsConnected] = useState(false);

    const handleConnect = () => {
        setIsConnected(true);
    };

    const handleDisconnect = () => {
        setIsConnected(false);
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle>LiveKit Integration Test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!isConnected ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Room Name</label>
                                <Input
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="Enter room name"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Participant Name</label>
                                <Input
                                    value={participantName}
                                    onChange={(e) => setParticipantName(e.target.value)}
                                    placeholder="Enter participant name"
                                />
                            </div>
                            <Button onClick={handleConnect}>Connect to LiveKit</Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Active Session</h3>
                                <Button variant="destructive" onClick={handleDisconnect}>
                                    Disconnect
                                </Button>
                            </div>
                            <div className="h-[400px] border rounded-lg overflow-hidden bg-slate-950">
                                <LiveKitAgent
                                    roomName={roomName}
                                    participantName={participantName}
                                    className="h-full w-full"
                                    onDisconnected={handleDisconnect}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
