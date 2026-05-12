import React, { Component } from 'react';
import { isWebGLAvailable, getFallbackImage } from '../utils/webgl';

/**
 * CanvasErrorBoundary - A reusable error boundary specifically for Three.js Views.
 * 
 * Features:
 * - Catches errors in 3D render loops without crashing the entire app
 * - Detects WebGL availability before rendering
 * - Provides customizable fallback UI (image or component)
 * - Isolates failures to specific sections (Hero, About, etc.)
 */
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      webglAvailable: true,
      errorMessage: '' 
    };
  }

  static getDerivedStateFromError(error) {
    // Catch React rendering errors
    return { 
      hasError: true, 
      errorMessage: error.message || 'Failed to load 3D content' 
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service (e.g., Sentry)
    console.error('CanvasErrorBoundary caught an error:', error, errorInfo);
    
    // Check if it's a WebGL context loss
    if (error.message?.includes('webgl') || error.message?.includes('context')) {
      this.setState({ webglAvailable: false });
    }
  }

  componentDidMount() {
    // Check WebGL availability on mount
    if (!isWebGLAvailable()) {
      this.setState({ webglAvailable: false });
    }
  }

  render() {
    const { hasError, webglAvailable, errorMessage } = this.state;
    const { children, fallback, sectionType = 'hero' } = this.props;

    // If WebGL is not available or an error occurred, show fallback
    if (!webglAvailable || hasError) {
      if (fallback) {
        return typeof fallback === 'function' ? fallback({ error: errorMessage, type: sectionType }) : fallback;
      }

      // Default fallback UI
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-6 max-w-md">
            <img 
              src={getFallbackImage(sectionType)} 
              alt={`${sectionType} fallback`}
              className="w-full h-auto rounded-lg shadow-xl mb-4 opacity-80"
              loading="lazy"
            />
            <p className="text-slate-400 text-sm">
              {webglAvailable 
                ? 'Interactive content temporarily unavailable' 
                : 'WebGL not supported on this device'}
            </p>
            {!webglAvailable && (
              <p className="text-slate-500 text-xs mt-2">
                Please enable hardware acceleration in your browser settings.
              </p>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default CanvasErrorBoundary;
