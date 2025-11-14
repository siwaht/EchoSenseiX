import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Database,
  Mic,
  Volume2,
  Brain,
  Phone,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Trash2,
  Settings
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const providerTypeIcons = {
  TTS: Volume2,
  STT: Mic,
  LLM: Brain,
  DATABASE: Database,
  VOICE_PLATFORM: Phone,
};

const providerTypeColors = {
  TTS: "text-blue-600 dark:text-blue-400",
  STT: "text-green-600 dark:text-green-400",
  LLM: "text-purple-600 dark:text-purple-400",
  DATABASE: "text-orange-600 dark:text-orange-400",
  VOICE_PLATFORM: "text-pink-600 dark:text-pink-400",
};

const availableProviders = {
  TTS: ["elevenlabs", "openai", "azure", "google", "aws-polly"],
  STT: ["deepgram", "whisper", "google", "azure", "assemblyai"],
  LLM: ["openai", "anthropic", "google-gemini", "azure", "local"],
  DATABASE: ["mongodb", "supabase", "sqlite", "mysql", "postgresql"],
  VOICE_PLATFORM: ["elevenlabs", "vapi", "bland", "retell"],
};

export default function Providers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProvider, setNewProvider] = useState({
    providerType: "DATABASE",
    providerName: "mongodb",
    displayName: "",
    credentials: "",
    config: "",
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["/api/providers", selectedType],
    queryFn: async () => {
      const url = selectedType === "all" ? "/api/providers" : `/api/providers?type=${selectedType}`;
      const response = await apiRequest("GET", url);
      return await response.json() || [];
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/providers", {
        ...data,
        credentials: data.credentials ? JSON.parse(data.credentials) : {},
        config: data.config ? JSON.parse(data.config) : {},
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      setIsDialogOpen(false);
      setNewProvider({
        providerType: "DATABASE",
        providerName: "mongodb",
        displayName: "",
        credentials: "",
        config: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add provider",
        variant: "destructive",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/providers/${id}/set-primary`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Primary provider updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set primary provider",
        variant: "destructive",
      });
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/providers/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case "INACTIVE":
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  const handleCreateProvider = () => {
    createProviderMutation.mutate(newProvider);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Provider Integrations
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage all your platform integrations in one place
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Provider Integration</DialogTitle>
              <DialogDescription>
                Connect a new TTS, STT, LLM, Database, or Voice Platform provider
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider Type</Label>
                  <Select
                    value={newProvider.providerType}
                    onValueChange={(value) => setNewProvider({ ...newProvider, providerType: value, providerName: availableProviders[value as keyof typeof availableProviders][0] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DATABASE">Database</SelectItem>
                      <SelectItem value="TTS">Text-to-Speech (TTS)</SelectItem>
                      <SelectItem value="STT">Speech-to-Text (STT)</SelectItem>
                      <SelectItem value="LLM">Large Language Model (LLM)</SelectItem>
                      <SelectItem value="VOICE_PLATFORM">Voice Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Provider Name</Label>
                  <Select
                    value={newProvider.providerName}
                    onValueChange={(value) => setNewProvider({ ...newProvider, providerName: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders[newProvider.providerType as keyof typeof availableProviders].map(p => (
                        <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  placeholder="e.g., Production MongoDB, Development Database"
                  value={newProvider.displayName}
                  onChange={(e) => setNewProvider({ ...newProvider, displayName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Credentials (JSON)</Label>
                <Textarea
                  placeholder='{"connectionString": "mongodb://...", "username": "...", "password": "..."}'
                  value={newProvider.credentials}
                  onChange={(e) => setNewProvider({ ...newProvider, credentials: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-gray-500">Encrypted and stored securely</p>
              </div>

              <div className="space-y-2">
                <Label>Configuration (JSON, Optional)</Label>
                <Textarea
                  placeholder='{"database": "echosenseix", "retryWrites": true}'
                  value={newProvider.config}
                  onChange={(e) => setNewProvider({ ...newProvider, config: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProvider} disabled={createProviderMutation.isPending || !newProvider.displayName}>
                {createProviderMutation.isPending ? "Adding..." : "Add Provider"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("all")}
        >
          All Providers
        </Button>
        <Button
          variant={selectedType === "DATABASE" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("DATABASE")}
        >
          <Database className="w-4 h-4 mr-2" />
          Databases
        </Button>
        <Button
          variant={selectedType === "TTS" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("TTS")}
        >
          <Volume2 className="w-4 h-4 mr-2" />
          TTS
        </Button>
        <Button
          variant={selectedType === "STT" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("STT")}
        >
          <Mic className="w-4 h-4 mr-2" />
          STT
        </Button>
        <Button
          variant={selectedType === "LLM" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("LLM")}
        >
          <Brain className="w-4 h-4 mr-2" />
          LLM
        </Button>
      </div>

      {/* Providers Grid */}
      {providers && providers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider: any) => {
            const Icon = providerTypeIcons[provider.providerType as keyof typeof providerTypeIcons] || Database;
            const colorClass = providerTypeColors[provider.providerType as keyof typeof providerTypeColors] || "text-gray-600";

            return (
              <Card key={provider.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${colorClass}`} />
                      <div>
                        <CardTitle className="text-base">{provider.displayName}</CardTitle>
                        <CardDescription className="text-xs">{provider.providerName.toUpperCase()}</CardDescription>
                      </div>
                    </div>
                    {provider.isPrimary && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Status:</span>
                    {getStatusBadge(provider.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Type:</span>
                    <Badge variant="outline" className="text-xs">
                      {provider.providerType}
                    </Badge>
                  </div>

                  {provider.lastTested && (
                    <div className="text-xs text-gray-500">
                      Last tested: {new Date(provider.lastTested).toLocaleString()}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {!provider.isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setPrimaryMutation.mutate(provider.id)}
                        disabled={setPrimaryMutation.isPending}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Set Primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteProviderMutation.mutate(provider.id)}
                      disabled={deleteProviderMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Providers Configured</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by adding your first provider integration
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
