import { Component } from "react";

// If one tab throws while rendering, show a message in that tab instead of
// letting React unmount the whole app (which looked like a blank page after
// login). Switching tabs resets it, because the parent keys it by tab.
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Tab crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="tab">
        <p className="message message--error" role="alert">
          This tab hit an error and couldn't be shown: {String(this.state.error?.message ?? this.state.error)}
        </p>
        <button type="button" className="btn-outline" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
