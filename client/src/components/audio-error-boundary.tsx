import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Volume2, VolumeX, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AudioErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Audio error boundary caught:", error, errorInfo);
    
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log audio-specific errors
    if (process.env.NODE_ENV === 'production') {
      this.logAudioError(error, errorInfo);
    }
  }

  private logAudioError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      console.error('Audio error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        audioContext: 'AudioContext' in window ? 'supported' : 'not supported',
        mediaDevices: 'mediaDevices' in navigator ? 'supported' : 'not supported',
        userAgent: navigator.userAgent
      });
    } catch (loggingError) {
      console.error('Failed to log audio error:', loggingError);
    }
  };

  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null
    });
  };

  private isAudioContextError = () => {
    const { error } = this.state;
    if (!error) return false;
    
    return error.message.includes('AudioContext') || 
           error.message.includes('audio') ||
           error.message.includes('Audio') ||
           error.message.includes('playback') ||
           error.message.includes('media');
  };

  private getErrorType = () => {
    const { error } = this.state;
    if (!error) return 'unknown';

    if (this.isAudioContextError()) return 'audio';
    if (error.message.includes('network') || error.message.includes('fetch')) return 'network';
    if (error.message.includes('permission')) return 'permission';
    if (error.message.includes('format') || error.message.includes('codec')) return 'format';
    
    return 'unknown';
  };

  private getErrorMessage = () => {
    const errorType = this.getErrorType();
    const { error } = this.state;

    switch (errorType) {
      case 'audio':
        return {
          title: 'Audio Playback Issue',
          message: 'There was a problem playing the audio. This might be due to browser restrictions or audio format compatibility.',
          icon: <VolumeX className="w-6 h-6 text-red-600 dark:text-red-400" />,
          suggestions: [
            'Try refreshing the page',
            'Check your browser audio settings',
            'Ensure the audio format is supported',
            'Try a different browser'
          ]
        };
      case 'network':
        return {
          title: 'Network Error',
          message: 'Unable to load the audio file. Please check your internet connection.',
          icon: <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />,
          suggestions: [
            'Check your internet connection',
            'Try again in a moment',
            'Verify the audio file URL is accessible'
          ]
        };
      case 'permission':
        return {
          title: 'Permission Denied',
          message: 'Audio playback requires permission. Please allow audio in your browser.',
          icon: <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
          suggestions: [
            'Click the audio icon in your browser address bar',
            'Allow audio permissions for this site',
            'Refresh the page after granting permission'
          ]
        };
      case 'format':
        return {
          title: 'Audio Format Error',
          message: 'The audio format is not supported by your browser.',
          icon: <Volume2 className="w-6 h-6 text-red-600 dark:text-red-400" />,
          suggestions: [
            'Try using a different browser',
            'Update your browser to the latest version',
            'Check if the audio file is corrupted'
          ]
        };
      default:
        return {
          title: 'Audio Component Error',
          message: error?.message || 'An unexpected error occurred with the audio component.',
          icon: <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />,
          suggestions: [
            'Try refreshing the page',
            'Check the browser console for more details',
            'Contact support if the issue persists'
          ]
        };
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorInfo = this.getErrorMessage();
      const errorType = this.getErrorType();

      return (
        <div className="flex items-center justify-center min-h-[300px] p-4">
          <Card className="max-w-lg w-full p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                {errorInfo.icon}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {errorInfo.title}
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    {errorType}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {errorInfo.message}
                </p>

                {/* Suggestions */}
                <div className="text-left bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <h4 className="text-sm font-medium mb-2">Try these solutions:</h4>
                  <ul className="text-xs space-y-1">
                    {errorInfo.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span className="text-gray-600 dark:text-gray-400">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <Button 
                onClick={this.handleReset} 
                variant="default"
                className="flex items-center gap-2 mt-4"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>

              {/* Development Error Details */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="w-full mt-4 text-left">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Error details (Development)
                  </summary>
                  <div className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                    <pre>{this.state.error.message}</pre>
                  </div>
                </details>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
