import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border-2 border-red-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Oops! Something went wrong
              </h1>

              <p className="text-gray-600 mb-6">
                The application encountered an unexpected error. Don't worry, your data is safe!
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 w-full text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                    Error details (dev mode)
                  </summary>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 text-red-600">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 w-full">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  <RefreshCcw className="h-5 w-5" />
                  Reload Page
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 py-3 px-4 rounded-lg font-semibold border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <Home className="h-5 w-5" />
                  Go Home
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-6">
                If this keeps happening, please contact support
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
