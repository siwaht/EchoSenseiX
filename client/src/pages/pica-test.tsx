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
