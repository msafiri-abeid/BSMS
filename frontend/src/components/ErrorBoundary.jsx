import { Component } from 'react';
import { Button, Result } from 'antd';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-8">
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred'}
            extra={[
              <Button key="retry" type="primary" onClick={this.handleReset}
                className="!bg-brand-dark">
                Try Again
              </Button>,
              <Button key="home" onClick={() => window.location.href = '/'}>
                Go to Dashboard
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}