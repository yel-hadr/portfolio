import React from 'react';
import ErrorFallback from './ErrorFallback';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  // The focused Reload button is gone after a reset: focus goes to the section it reloaded
  componentDidUpdate(_, prev) {
    if (prev.hasError && !this.state.hasError) {
      const section = document.getElementById(this.props.sectionName);
      section?.setAttribute('tabindex', '-1');
      section?.focus({ preventScroll: true });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
          sectionName={this.props.sectionName}
          reloadPage={this.props.reloadPage}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
