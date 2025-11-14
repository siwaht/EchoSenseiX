/**
 * Database Integration Configuration Component
 *
 * Allows users to view and configure database connections
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Database, CheckCircle, XCircle, AlertCircle, RefreshCw, Server } from "lucide-react";

interface DatabaseConfig {
  provider: 'mongodb' | 'postgresql' | 'mysql' | 'sqlite';
  status: 'connected' | 'disconnected' | 'unknown';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
}

interface DatabaseStatus {
  status: 'connected' | 'disconnected' | 'unknown';
  provider: string;
  timestamp: string;
  message: string;
  error?: string;
}

export function DatabaseIntegrationConfig() {
  const { toast } = useToast();

  // Fetch database status from backend
  const { data: dbStatus, isLoading, refetch } = useQuery<DatabaseStatus>({
    queryKey: ["/api/database/status"],
    retry: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    provider: 'sqlite',
    status: 'unknown',
    database: 'echosensei'
  });

  // Update local config when status is fetched
  useEffect(() => {
    if (dbStatus) {
      setDbConfig(prev => ({
        ...prev,
        provider: (dbStatus.provider || 'sqlite') as any,
        status: dbStatus.status as any,
      }));
    }
  }, [dbStatus]);

  const handleTestConnection = async () => {
    try {
      await refetch();

      toast({
        title: "Connection Test Complete",
        description: dbConfig.status === 'connected' ?
          `Successfully connected to ${dbConfig.provider} database` :
          "Unable to connect to database",
        variant: dbConfig.status === 'connected' ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Could not test database connection",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = () => {
    switch (dbConfig.status) {
      case 'connected':
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            <CheckCircle className="w-4 h-4 mr-2" />
            Connected
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
            <XCircle className="w-4 h-4 mr-2" />
            Disconnected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="w-4 h-4 mr-2" />
            Unknown
          </Badge>
        );
    }
  };

  const getProviderIcon = () => {
    switch (dbConfig.provider) {
      case 'mongodb':
        return '🍃';
      case 'postgresql':
        return '🐘';
      case 'mysql':
        return '🐬';
      case 'sqlite':
        return '📁';
      default:
        return '💾';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Configuration
          </CardTitle>
          <CardDescription>
            View and manage your database connection settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Configuration */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getProviderIcon()}</span>
                <div>
                  <h3 className="text-lg font-semibold capitalize">{dbConfig.provider}</h3>
                  <p className="text-sm text-muted-foreground">Current Database Provider</p>
                </div>
              </div>
              {getStatusBadge()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Provider:</p>
                <p className="font-medium capitalize">{dbConfig.provider}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Database:</p>
                <p className="font-medium">{dbConfig.database || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Status:</p>
                <p className="font-medium capitalize">{dbConfig.status}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Connection Pool:</p>
                <p className="font-medium">Active</p>
              </div>
            </div>
          </div>

          {/* Connection Test */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Connection Status</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Test your database connection to ensure everything is working properly
                </p>
              </div>
              <Button
                onClick={handleTestConnection}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Information */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Database Configuration
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Database configuration is managed through environment variables</li>
              <li>• Changes require server restart to take effect</li>
              <li>• Connection pooling is automatically managed</li>
              <li>• All data is encrypted at rest and in transit</li>
            </ul>
          </div>

          {/* Supported Providers */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Supported Database Providers</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'MongoDB', icon: '🍃', active: dbConfig.provider === 'mongodb' },
                { name: 'PostgreSQL', icon: '🐘', active: dbConfig.provider === 'postgresql' },
                { name: 'MySQL', icon: '🐬', active: dbConfig.provider === 'mysql' },
                { name: 'SQLite', icon: '📁', active: dbConfig.provider === 'sqlite' },
              ].map((provider) => (
                <div
                  key={provider.name}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    provider.active
                      ? 'bg-primary/10 border-primary'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{provider.icon}</div>
                  <div className="text-xs font-medium">{provider.name}</div>
                  {provider.active && (
                    <CheckCircle className="w-3 h-3 text-primary mx-auto mt-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
