import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Smile, Meh, Frown, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentIndicatorProps {
  transcript: any;
  showDetails?: boolean;
}

export function SentimentIndicator({ transcript, showDetails = false }: SentimentIndicatorProps) {
  const sentimentAnalysis = useMemo(() => {
    if (!transcript) return null;

    // Parse transcript based on its format
    let messages: any[] = [];
    
    if (Array.isArray(transcript)) {
      messages = transcript;
    } else if (typeof transcript === 'string') {
      try {
        const parsed = JSON.parse(transcript);
        if (Array.isArray(parsed)) {
          messages = parsed;
        }
      } catch {
        return null;
      }
    }

    if (messages.length === 0) return null;

    // Positive and negative word lists for sentiment analysis
    const positiveWords = [
      'thank', 'thanks', 'appreciate', 'great', 'excellent', 'good', 'wonderful',
      'perfect', 'amazing', 'helpful', 'love', 'best', 'happy', 'satisfied',
      'pleased', 'fantastic', 'awesome', 'brilliant', 'outstanding', 'yes',
      'definitely', 'absolutely', 'sure', 'okay', 'nice', 'pleasant'
    ];
    
    const negativeWords = [
      'no', 'not', 'never', 'bad', 'terrible', 'awful', 'horrible', 'worst',
      'hate', 'dislike', 'angry', 'frustrated', 'annoyed', 'disappointed',
      'unhappy', 'problem', 'issue', 'wrong', 'error', 'failed', 'broken',
      'complaint', 'unacceptable', 'poor', 'useless', 'waste'
    ];

    const questionWords = ['what', 'when', 'where', 'why', 'how', 'who', 'which', 'whose'];

    let positiveCount = 0;
    let negativeCount = 0;
    let questionCount = 0;
    let totalWords = 0;
    let customerMessages = 0;
    let agentMessages = 0;

    // Analyze each message
    messages.forEach((msg: any) => {
      const text = (msg.message || '').toLowerCase();
      const words = text.split(/\s+/);
      
      if (msg.role === 'user') {
        customerMessages++;
      } else if (msg.role === 'agent') {
        agentMessages++;
      }

      words.forEach((word: string) => {
        totalWords++;
        
        if (positiveWords.some(pw => word.includes(pw))) {
          positiveCount++;
        }
        if (negativeWords.some(nw => word.includes(nw))) {
          negativeCount++;
        }
        if (questionWords.some(qw => word.startsWith(qw))) {
          questionCount++;
        }
      });
    });

    // Calculate sentiment score (-1 to 1)
    const sentimentScore = totalWords > 0 
      ? (positiveCount - negativeCount) / totalWords 
      : 0;

    // Determine overall sentiment
    let sentiment: 'positive' | 'neutral' | 'negative';
    let icon: any;
    let color: string;
    
    if (sentimentScore > 0.05) {
      sentiment = 'positive';
      icon = Smile;
      color = 'text-green-600 dark:text-green-400';
    } else if (sentimentScore < -0.05) {
      sentiment = 'negative';
      icon = Frown;
      color = 'text-red-600 dark:text-red-400';
    } else {
      sentiment = 'neutral';
      icon = Meh;
      color = 'text-yellow-600 dark:text-yellow-400';
    }

    // Calculate conversation trend
    const firstHalfMessages = messages.slice(0, Math.floor(messages.length / 2));
    const secondHalfMessages = messages.slice(Math.floor(messages.length / 2));
    
    let firstHalfScore = 0;
    let secondHalfScore = 0;
    
    firstHalfMessages.forEach((msg: any) => {
      const text = (msg.message || '').toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) firstHalfScore++;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) firstHalfScore--;
      });
    });
    
    secondHalfMessages.forEach((msg: any) => {
      const text = (msg.message || '').toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) secondHalfScore++;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) secondHalfScore--;
      });
    });
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondHalfScore > firstHalfScore + 2) {
      trend = 'improving';
    } else if (secondHalfScore < firstHalfScore - 2) {
      trend = 'declining';
    }

    return {
      sentiment,
      sentimentScore,
      icon,
      color,
      positiveCount,
      negativeCount,
      questionCount,
      totalWords,
      customerMessages,
      agentMessages,
      trend
    };
  }, [transcript]);

  if (!sentimentAnalysis) return null;

  const Icon = sentimentAnalysis.icon;
  const TrendIcon = sentimentAnalysis.trend === 'improving' 
    ? TrendingUp 
    : sentimentAnalysis.trend === 'declining' 
    ? TrendingDown 
    : Minus;

  if (!showDetails) {
    return (
      <Badge 
        variant="outline"
        className={`${sentimentAnalysis.color} border-current`}
        data-testid="badge-sentiment"
      >
        <Icon className="w-3 h-3 mr-1" />
        {sentimentAnalysis.sentiment}
      </Badge>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-700 ${sentimentAnalysis.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium capitalize">
            {sentimentAnalysis.sentiment} Sentiment
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Score: {(sentimentAnalysis.sentimentScore * 100).toFixed(1)}%
          </p>
        </div>
        <div className="ml-auto">
          <Badge 
            variant="outline"
            className="text-xs"
            data-testid="badge-sentiment-trend"
          >
            <TrendIcon className="w-3 h-3 mr-1" />
            {sentimentAnalysis.trend}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
          <p className="font-medium text-green-700 dark:text-green-300">Positive</p>
          <p className="text-green-600 dark:text-green-400">{sentimentAnalysis.positiveCount}</p>
        </div>
        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
          <p className="font-medium text-red-700 dark:text-red-300">Negative</p>
          <p className="text-red-600 dark:text-red-400">{sentimentAnalysis.negativeCount}</p>
        </div>
        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
          <p className="font-medium text-blue-700 dark:text-blue-300">Questions</p>
          <p className="text-blue-600 dark:text-blue-400">{sentimentAnalysis.questionCount}</p>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>Customer messages: {sentimentAnalysis.customerMessages}</p>
        <p>Agent messages: {sentimentAnalysis.agentMessages}</p>
        <p>Total words analyzed: {sentimentAnalysis.totalWords}</p>
      </div>
    </div>
  );
}