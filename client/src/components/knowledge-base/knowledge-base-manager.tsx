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
import { Search, Plus, BookOpen, Brain, MessageSquare, Lightbulb, Tag, Settings, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [entryToDelete, setEntryToDelete] = useState<KnowledgeBaseEntry | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Add Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete knowledge base entry
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/knowledge-base/entries/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete entry");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry Deleted",
        description: "Knowledge base entry deleted successfully",
      });
      setEntryToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
      setEntryToDelete(null);
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="add">Add Entry</TabsTrigger>
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
                                <div className="flex-1">
                                  <h5 className="font-medium">{source.title}</h5>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEntryToDelete(source)}
                                  className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
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
                    <div className="space-y-6">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Knowledge Base Integration Benefits
                        </h4>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            Voice agents can answer questions from your knowledge base
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            Natural language understanding for complex queries
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            Automatic source citation and follow-up suggestions
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            Multilingual support with ElevenLabs models
                          </li>
                        </ul>
                      </div>

                      <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                          <Settings className="w-5 h-5" />
                          How to Configure Agents
                        </h4>
                        <div className="text-sm text-emerald-700 dark:text-emerald-300 space-y-2">
                          <p>To enhance your voice agents with knowledge base capabilities:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-4">
                            <li>Go to the <strong>Agent Settings</strong> tab in the navigation</li>
                            <li>Select an agent from the dropdown</li>
                            <li>Navigate to the <strong>Knowledge</strong> tab</li>
                            <li>Configure knowledge base integration settings</li>
                          </ol>
                        </div>
                      </div>

                      <div className="text-center py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-full border border-primary/20">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            Knowledge Base Ready for Integration
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{entryToDelete?.title}</strong>"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entryToDelete && deleteEntryMutation.mutate(entryToDelete.id)}
              disabled={deleteEntryMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEntryMutation.isPending ? "Deleting..." : "Delete Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
