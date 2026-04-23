import { Component, type ErrorInfo, type ReactNode } from "react";
import { report } from "../services/error-reporter";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    report({
      platform: "web",
      version: __APP_VERSION__,
      errorCode: "RENDER_ERROR",
      message: error.message,
      stackTrace: errorInfo.componentStack ?? undefined,
      metadata: {
        errorStack: error.stack,
      },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

declare const __APP_VERSION__: string;
