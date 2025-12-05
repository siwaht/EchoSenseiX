import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function PicaTestPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const { toast } = useToast();

    const testConnection = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/pica/connections');
            const data = await response.json();
            setResult(data);
            toast({
                title: "Connection Test",
                description: response.ok ? "Success" : "Failed",
                variant: response.ok ? "default" : "destructive",
            });
        } catch (error: any) {
            setResult({ error: error.message });
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const testCreateAgent = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/pica/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tool: 'elevenlabs',
                    action: 'create_agent',
                    params: {
                        name: 'Test Agent',
                        description: 'Created via PicaOS Integration Test'
                    }
                })
            });
            const data = await response.json();
            setResult(data);
            toast({
                title: "Create Agent Test",
                description: response.ok ? "Success" : "Failed",
                variant: response.ok ? "default" : "destructive",
            });
        } catch (error: any) {
            setResult({ error: error.message });
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">PicaOS Integration Test</h1>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Test Connection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={testConnection} disabled={loading}>
                            {loading ? 'Testing...' : 'List Connections'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test Agent Creation (Mock)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={testCreateAgent} disabled={loading}>
                            {loading ? 'Testing...' : 'Create Test Agent'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test Stripe Integration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'stripe',
                                            action: 'create_payment_link',
                                            params: {
                                                amount: 1000,
                                                currency: 'usd',
                                                description: 'Test Payment via PicaOS'
                                            }
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "Stripe Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Create Payment Link'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test Twilio Migration (via PicaOS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'twilio',
                                            action: 'get_phone_numbers',
                                            params: {}
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "Twilio Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'List Phone Numbers'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test OpenAI Migration (via PicaOS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'openai',
                                            action: 'chat_completion',
                                            params: {
                                                messages: [{ role: 'user', content: 'Hello from PicaOS migration test!' }],
                                                model: 'gpt-4o'
                                            }
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "OpenAI Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Test Chat Completion'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test MongoDB Integration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'mongodb',
                                            action: 'find',
                                            params: {
                                                collection: 'users',
                                                filter: { email: 'test@example.com' }
                                            }
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "MongoDB Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Test Mongo Find'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test Supabase Integration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'supabase',
                                            action: 'query',
                                            params: {
                                                table: 'users',
                                                select: '*'
                                            }
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "Supabase Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Test Supabase Query'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test TTS Integration (via PicaOS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'elevenlabs',
                                            action: 'get_voices',
                                            params: {}
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "TTS Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Test Get Voices'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Test STT Integration (via PicaOS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    // Mocking audio buffer for test
                                    const response = await fetch('/api/pica/actions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            tool: 'openai',
                                            action: 'transcribe',
                                            params: {
                                                file: 'mock_base64_audio_data',
                                                model: 'whisper-1'
                                            }
                                        })
                                    });
                                    const data = await response.json();
                                    setResult(data);
                                    toast({
                                        title: "STT Test",
                                        description: response.ok ? "Success" : "Failed",
                                        variant: response.ok ? "default" : "destructive",
                                    });
                                } catch (error: any) {
                                    setResult({ error: error.message });
                                    toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive",
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            {loading ? 'Testing...' : 'Test Transcribe'}
                        </Button>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-96">
                            {result ? JSON.stringify(result, null, 2) : 'No result yet'}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
