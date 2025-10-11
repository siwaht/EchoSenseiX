/**
 * Knowledge Base Manager Component
 * 
 * Provides interface for managing knowledge base entries and integrating with voice agents
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, BookOpen, Brain, MessageSquare, Lightbulb, Tag, Upload } from "lucide-react";
import { DocumentUpload } from "./document-upload";

interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseResponse {
  answer: string;
  sources: KnowledgeBaseEntry[];
  confidence: number;
  followUpQuestions?: string[];
}

export function KnowledgeBaseManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newEntry, setNewEntry] = useState({
    title: "",
    content: "",
    category: "General",
    tags: ""
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search knowledge base
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/knowledge-base/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, category: selectedCategory !== "all" ? selectedCategory : undefined })
      });
      
      if (!response.ok) {
        throw new Error("Search failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Search Complete",
        description: `Found ${data.data.sources.length} relevant sources`,
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add knowledge base entry
  const addEntryMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      const response = await fetch("/api/knowledge-base/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: entry.title,
          content: entry.content,
          category: entry.category,
          tags: entry.tags.split(",").map(tag => tag.trim()).filter(tag => tag)
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to add entry");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry Added",
        description: "Knowledge base entry added successfully",
      });
      setIsAddDialogOpen(false);
      setNewEntry({ title: "", content: "", category: "General", tags: "" });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
    onError: (error) => {
      toast({
        title: "Add Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleAddEntry = () => {
    if (newEntry.title.trim() && newEntry.content.trim()) {
      addEntryMutation.mutate(newEntry);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Knowledge Base Manager
          </CardTitle>
          <CardDescription>
            Manage your organization's knowledge base and integrate it with voice agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="add">Add Entry</TabsTrigger>
              <TabsTrigger value="upload">Upload Documents</TabsTrigger>
              <TabsTrigger value="integrate">Integrate with Agents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Best Practices">Best Practices</SelectItem>
                    <SelectItem value="Troubleshooting">Troubleshooting</SelectItem>
                    <SelectItem value="Product Information">Product Information</SelectItem>
                    <SelectItem value="User Guides">User Guides</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                  <Search className="w-4 h-4 mr-2" />
                  {searchMutation.isPending ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchMutation.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Search Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Answer:</h4>
                      <p className="text-sm text-gray-700">
                        {searchMutation.data.data.answer}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">
                          Confidence: {Math.round(searchMutation.data.data.confidence * 100)}%
                        </Badge>
                      </div>
                    </div>

                    {searchMutation.data.data.sources.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Sources:</h4>
                        <div className="space-y-2">
                          {searchMutation.data.data.sources.map((source: KnowledgeBaseEntry) => (
                            <Card key={source.id} className="p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="font-medium">{source.title}</h5>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {source.content.substring(0, 200)}...
                                  </p>
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant="secondary">{source.category}</Badge>
                                    {source.tags.map(tag => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        <Tag className="w-3 h-3 mr-1" />
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchMutation.data.data.followUpQuestions && (
                      <div>
                        <h4 className="font-medium mb-2">Suggested Follow-up Questions:</h4>
                        <div className="space-y-1">
                          {searchMutation.data.data.followUpQuestions.map((question: string, index: number) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              className="text-left justify-start h-auto p-2"
                              onClick={() => setSearchQuery(question)}
                            >
                              <Lightbulb className="w-3 h-3 mr-2" />
                              {question}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="add" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Knowledge Entry
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter entry title..."
                      value={newEntry.title}
                      onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newEntry.category} onValueChange={(value) => setNewEntry({ ...newEntry, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Best Practices">Best Practices</SelectItem>
                        <SelectItem value="Troubleshooting">Troubleshooting</SelectItem>
                        <SelectItem value="Product Information">Product Information</SelectItem>
                        <SelectItem value="User Guides">User Guides</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      placeholder="voice, agents, api..."
                      value={newEntry.tags}
                      onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter the knowledge base content..."
                      rows={6}
                      value={newEntry.content}
                      onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                    />
                  </div>

                  <Button 
                    onClick={handleAddEntry} 
                    disabled={addEntryMutation.isPending || !newEntry.title.trim() || !newEntry.content.trim()}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addEntryMutation.isPending ? "Adding..." : "Add Entry"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <DocumentUpload />
            </TabsContent>

            <TabsContent value="integrate" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Integrate with Voice Agents
                  </CardTitle>
                  <CardDescription>
                    Enhance your voice agents with knowledge base capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Benefits of Knowledge Base Integration:</h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Voice agents can answer questions from your knowledge base</li>
                        <li>• Natural language understanding for complex queries</li>
                        <li>• Automatic source citation and follow-up suggestions</li>
                        <li>• Multilingual support with ElevenLabs models</li>
                      </ul>
                    </div>

                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Ready to Enhance Your Agents?</h3>
                      <p className="text-gray-600 mb-4">
                        Go to your Agents page and click "Enhance with Knowledge Base" on any agent to get started.
                      </p>
                      <Button>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Go to Agents
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
