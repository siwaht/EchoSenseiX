import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showRetry?: boolean;
  showHome?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, you would send this to an error reporting service
    // like Sentry, LogRocket, or Bugsnag
    try {
      console.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        context: this.props.context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  };

  private handleReset = () => {
    const newRetryCount = this.state.retryCount + 1;

    if (newRetryCount >= 3) {
      // After 3 retries, reload the page
      window.location.reload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, retryCount } = this.state;
      const { context, showRetry = true, showHome = true } = this.props;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-lg w-full p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Oops! Something went wrong
                </h2>

                {context && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
                    <strong>Context:</strong> {context}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {retryCount > 0
                    ? `Retry attempt ${retryCount}/3. We're working to fix this issue.`
                    : "We encountered an unexpected error. Please try again or go back to the main page."
                  }
                </p>

                {retryCount >= 3 && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded">
                    Multiple retry attempts failed. Consider refreshing the page or contacting support.
                  </div>
                )}
              </div>

              {/* Error Details for Development */}
              {process.env.NODE_ENV === 'development' && error && (
                <details className="w-full mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Error details (Development)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                      <div className="font-semibold mb-1">Error Message:</div>
                      <div className="text-red-600 dark:text-red-400">{error.message}</div>
                    </div>
                    {this.state.errorInfo && (
                      <div className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-32">
                        <div className="font-semibold mb-1">Component Stack:</div>
                        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                {showRetry && (
                  <Button
                    onClick={this.handleReset}
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {retryCount >= 3 ? 'Reload Page' : 'Try Again'}
                  </Button>
                )}

                {showHome && (
                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </Button>
                )}
              </div>

              {/* Retry Counter */}
              {retryCount > 0 && retryCount < 3 && (
                <div className="text-xs text-gray-500 mt-2">
                  Attempt {retryCount} of 3
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}