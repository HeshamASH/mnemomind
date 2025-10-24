import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// FIX: Refactored the class component to use modern class property syntax.
// The previous implementation with a constructor was causing TypeScript errors where properties
// from React.Component (like 'state', 'props', 'setState') were not being recognized on the class instance.
// This syntax is cleaner and correctly binds 'this' for methods like handleReset, resolving all related errors.
// FIX: Extend React.Component directly to avoid potential naming conflicts.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 my-2 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm" role="alert">
          <h3 className="font-bold mb-2">Oops! Something went wrong.</h3>
          <p className="mb-2">An unexpected error occurred while rendering this part of the interface.</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
