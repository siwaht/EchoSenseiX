import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Clock, User, Bot, Zap, RefreshCw } from "lucide-react";
import type { CallLog } from "@shared/schema";

interface TranscriptSearchProps {
  callLogs: CallLog[];
  onSearchResults: (results: CallLog[]) => void;
  onClearSearch: () => void;
}

interface SearchResult {
  callLog: CallLog;
  matches: Array<{
    speaker: string;
    text: string;
    timestamp?: string;
    highlightedText: string;
  }>;
  relevanceScore: number;
}

export function TranscriptSearch({ callLogs, onSearchResults, onClearSearch }: TranscriptSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Parse transcript into structured format
  const parseTranscript = useCallback((transcript: any) => {
    if (!transcript) return [];

    if (Array.isArray(transcript)) {
      return transcript.map((turn: any, index: number) => ({
        id: index,
        speaker: turn.role || turn.speaker || 'unknown',
        text: turn.message || turn.content || turn.text || '',
        timestamp: turn.timestamp || turn.time_in_call_secs || null
      }));
    } else if (typeof transcript === 'string') {
      try {
        const parsed = JSON.parse(transcript);
        if (Array.isArray(parsed)) {
          return parsed.map((turn: any, index: number) => ({
            id: index,
            speaker: turn.role || turn.speaker || 'unknown',
            text: turn.message || turn.content || turn.text || '',
            timestamp: turn.timestamp || turn.time_in_call_secs || null
          }));
        }
      } catch {
        // If parsing fails, treat as plain text
        return [{
          id: 0,
          speaker: 'unknown',
          text: transcript,
          timestamp: null
        }];
      }
    }

    return [];
  }, []);

  // Highlight search terms in text
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  }, []);

  // Enhanced search with relevance scoring and highlighting
  const searchTranscripts = useCallback((query: string): SearchResult[] => {
    if (!query.trim()) {
      return callLogs.map(callLog => ({
        callLog,
        matches: [],
        relevanceScore: 0
      }));
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const results: SearchResult[] = [];

    callLogs.forEach(callLog => {
      if (!callLog.transcript) return;

      const transcriptEntries = parseTranscript(callLog.transcript);
      const matches: SearchResult['matches'] = [];
      let relevanceScore = 0;

      transcriptEntries.forEach(entry => {
        const text = entry.text.toLowerCase();
        let entryScore = 0;
        let hasMatch = false;

        searchTerms.forEach(term => {
          const termRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches_found = text.match(termRegex);
          
          if (matches_found) {
            hasMatch = true;
            // Score based on number of matches and position
            entryScore += matches_found.length * 10;
            
            // Boost score for exact phrase matches
            if (text.includes(query.toLowerCase())) {
              entryScore += 50;
            }
            
            // Boost score for beginning of text
            const firstMatchIndex = text.indexOf(term);
            if (firstMatchIndex < 50) {
              entryScore += 20;
            }
          }
        });

        if (hasMatch) {
          relevanceScore += entryScore;
          matches.push({
            speaker: entry.speaker,
            text: entry.text,
            timestamp: entry.timestamp,
            highlightedText: highlightText(entry.text, query) as any
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          callLog,
          matches,
          relevanceScore
        });
      }
    });

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [callLogs, parseTranscript, highlightText]);

  // Handle search with enhanced results
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      onClearSearch();
      return;
    }
    
    setIsSearching(true);
    
    try {
      const results = searchTranscripts(searchQuery);
      setSearchResults(results);
      onSearchResults(results.map(r => r.callLog));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchTranscripts, onSearchResults, onClearSearch]);

  // Clear search
  const handleClear = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    onClearSearch();
  }, [onClearSearch]);

  // Auto-search as user types (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300); // Reduced debounce time for better UX

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search in transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-10"
            data-testid="input-transcript-search"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          variant="secondary"
          data-testid="button-search-transcripts"
        >
          {isSearching ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>
        {searchQuery && searchResults.length !== callLogs.length && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Badge variant="secondary">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </Badge>
            {searchResults.length > 0 && (
              <Badge variant="outline">
                Relevance: {Math.round(searchResults[0]?.relevanceScore || 0)}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Search Results Preview */}
      {searchQuery && searchResults.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Search className="w-4 h-4" />
            Search Results Preview
          </div>
          
          {searchResults.slice(0, 3).map((result, index) => (
            <div key={result.callLog.id} className="bg-white dark:bg-gray-700 rounded border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Call #{result.callLog.id.slice(-6)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {result.callLog.duration ? `${Math.floor(result.callLog.duration / 60)}m ${result.callLog.duration % 60}s` : 'N/A'}
                </div>
              </div>
              
              {result.matches.slice(0, 2).map((match, matchIndex) => (
                <div key={matchIndex} className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    {match.speaker === 'user' || match.speaker === 'customer' ? (
                      <User className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Bot className="w-3 h-3 text-green-500" />
                    )}
                    <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">
                      {match.speaker}
                    </span>
                    {match.timestamp && (
                      <span className="text-xs text-gray-400">
                        {match.timestamp}s
                      </span>
                    )}
                  </div>
                  <div className="text-gray-700 dark:text-gray-300 ml-5">
                    {match.highlightedText}
                  </div>
                </div>
              ))}
              
              {result.matches.length > 2 && (
                <div className="text-xs text-gray-500 mt-2">
                  +{result.matches.length - 2} more matches
                </div>
              )}
            </div>
          ))}
          
          {searchResults.length > 3 && (
            <div className="text-center text-sm text-gray-500">
              And {searchResults.length - 3} more results...
            </div>
          )}
        </div>
      )}
    </div>
  );
}