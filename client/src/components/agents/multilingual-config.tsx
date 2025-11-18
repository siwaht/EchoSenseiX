/**
 * Multilingual Configuration Component
 * 
 * Matches ElevenLabs' language configuration interface
 * Supports additional languages, first messages, and system prompts
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Globe, MessageSquare, Brain, Languages, Check } from "lucide-react";

interface Language {
  code: string;
  name: string;
  flag: string;
  isDefault: boolean;
}

interface LanguageConfig {
  code: string;
  firstMessage?: string;
  systemPrompt?: string;
}

interface MultilingualConfigProps {
  agentId: string;
}

export function MultilingualConfig({ agentId }: MultilingualConfigProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [firstMessage, setFirstMessage] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [disableInterruptions, setDisableInterruptions] = useState<boolean>(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [supportedLanguages, setSupportedLanguages] = useState<LanguageConfig[]>([]);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available languages
  const { data: languagesData } = useQuery({
    queryKey: ["multilingual", "languages"],
    queryFn: async () => {
      const response = await fetch("/api/multilingual/languages", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch languages");
      return response.json();
    }
  });

  // Fetch agent's multilingual config
  const { data: agentConfig } = useQuery({
    queryKey: ["multilingual", "agent", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}/multilingual`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch agent config");
      return response.json();
    }
  });

  // Add language mutation
  const addLanguageMutation = useMutation({
    mutationFn: async (languageCode: string) => {
      const response = await fetch(`/api/agents/${agentId}/languages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          languageCode,
          firstMessage,
          systemPrompt
        })
      });
      if (!response.ok) throw new Error("Failed to add language");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Language Added",
        description: "Language successfully added to agent",
      });
      queryClient.invalidateQueries({ queryKey: ["multilingual", "agent", agentId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Remove language mutation
  const removeLanguageMutation = useMutation({
    mutationFn: async (languageCode: string) => {
      const response = await fetch(`/api/agents/${agentId}/languages/${languageCode}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to remove language");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Language Removed",
        description: "Language successfully removed from agent",
      });
      queryClient.invalidateQueries({ queryKey: ["multilingual", "agent", agentId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update language config mutation
  const updateLanguageMutation = useMutation({
    mutationFn: async ({ languageCode, firstMessage, systemPrompt }: {
      languageCode: string;
      firstMessage?: string;
      systemPrompt?: string;
    }) => {
      const response = await fetch(`/api/agents/${agentId}/languages/${languageCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstMessage,
          systemPrompt
        })
      });
      if (!response.ok) throw new Error("Failed to update language config");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Language configuration updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["multilingual", "agent", agentId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Translate to all languages mutation
  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      const supportedLanguageCodes = supportedLanguages.map(lang => lang.code);
      const response = await fetch("/api/multilingual/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text,
          targetLanguages: supportedLanguageCodes
        })
      });
      if (!response.ok) throw new Error("Failed to translate");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Translation Complete",
        description: "Text translated to all supported languages",
      });
      // Apply translations to current language if available
      if (data.data[selectedLanguage]) {
        setFirstMessage(data.data[selectedLanguage]);
      }
    },
    onError: (error) => {
      toast({
        title: "Translation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Initialize data
  useEffect(() => {
    if (languagesData?.data) {
      setAvailableLanguages(languagesData.data);
    }
  }, [languagesData]);

  useEffect(() => {
    if (agentConfig?.data) {
      setSupportedLanguages(agentConfig.data.supportedLanguages || []);
      // Set current language config
      const currentLang = agentConfig.data.languageOverrides?.[selectedLanguage];
      if (currentLang) {
        setFirstMessage(currentLang.firstMessage || "");
        setSystemPrompt(currentLang.systemPrompt || "");
      }
    }
  }, [agentConfig, selectedLanguage]);

  const handleAddLanguage = () => {
    const language = availableLanguages.find(lang => lang.code === selectedLanguage);
    if (language && !supportedLanguages.some(lang => lang.code === selectedLanguage)) {
      addLanguageMutation.mutate(selectedLanguage);
    }
  };

  const handleRemoveLanguage = (languageCode: string) => {
    removeLanguageMutation.mutate(languageCode);
  };

  const handleUpdateConfig = () => {
    updateLanguageMutation.mutate({
      languageCode: selectedLanguage,
      firstMessage,
      systemPrompt
    });
  };

  const handleTranslateToAll = () => {
    setIsTranslating(true);
    translateMutation.mutate(firstMessage, {
      onSettled: () => setIsTranslating(false)
    });
  };

  const getLanguageFlag = (code: string) => {
    const language = availableLanguages.find(lang => lang.code === code);
    return language?.flag || "🌍";
  };

  const getLanguageName = (code: string) => {
    const language = availableLanguages.find(lang => lang.code === code);
    return language?.name || code.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Additional Languages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Additional Languages
          </CardTitle>
          <CardDescription>
            Specify additional languages which callers can choose from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Supported Languages Display */}
          <div className="space-y-2">
            <Label>Supported Languages</Label>
            <div className="flex flex-wrap gap-2">
              {supportedLanguages.map((lang) => (
                <Badge key={lang.code} variant="secondary" className="flex items-center gap-1">
                  <span>{getLanguageFlag(lang.code)}</span>
                  <span>{getLanguageName(lang.code)}</span>
                  {lang.code !== 'en' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => handleRemoveLanguage(lang.code)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Add Language */}
          <div className="flex gap-2">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages
                  .filter(lang => !supportedLanguages.some(supported => supported.code === lang.code))
                  .map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAddLanguage}
              disabled={addLanguageMutation.isPending}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Language
            </Button>
          </div>

          <p className="text-sm text-gray-600">
            To support additional languages, language overrides will be enabled. You can view and configure all overrides in the 'Security' tab.
          </p>
        </CardContent>
      </Card>

      {/* First Message Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            First Message
          </CardTitle>
          <CardDescription>
            The first message the agent will say. If empty, the agent will wait for the user to start the conversation. You can specify different presets for each language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Label>Language:</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{getLanguageFlag(lang.code)}</span>
                      <span>{lang.code === 'en' ? 'Default (English)' : getLanguageName(lang.code)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First Message Input */}
          <div className="space-y-2">
            <Label>First Message</Label>
            <div className="relative">
              <Textarea
                placeholder="Hey there, I'm Alexis. How can I help you today?"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                rows={3}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleTranslateToAll}
                disabled={isTranslating || !firstMessage.trim()}
              >
                <Languages className="w-4 h-4 mr-1" />
                {isTranslating ? "Translating..." : "Translate to all"}
              </Button>
            </div>
          </div>

          {/* Disable Interruptions */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="disable-interruptions"
              checked={disableInterruptions}
              onCheckedChange={(checked) => setDisableInterruptions(checked === true)}
            />
            <Label htmlFor="disable-interruptions">
              Disable interruptions during first message
            </Label>
          </div>
          <p className="text-sm text-gray-600">
            Select this box to prevent users from interrupting while the first message is being delivered.
          </p>

          {/* Add Variable Button */}
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Variable
          </Button>
        </CardContent>
      </Card>

      {/* System Prompt Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            System Prompt
          </CardTitle>
          <CardDescription>
            The system prompt is used to determine the persona of the agent and the context of the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Label>Language:</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{getLanguageFlag(lang.code)}</span>
                      <span>{lang.code === 'en' ? 'Default (English)' : getLanguageName(lang.code)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Prompt Input */}
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              placeholder="Describe the desired agent (e.g., a customer support agent for ElevenLabs)"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
            />
          </div>

          {/* Update Button */}
          <Button 
            onClick={handleUpdateConfig}
            disabled={updateLanguageMutation.isPending}
            className="w-full"
          >
            <Check className="w-4 h-4 mr-2" />
            {updateLanguageMutation.isPending ? "Updating..." : "Update Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
