import { Component } from 'react';

/**
 * CanvasErrorBoundary - error boundary for 3D content rendered inside the shared R3F Canvas.
 *
 * It lives inside the Canvas tree (each scene is tunnelled into <View.Port />), where DOM
 * elements cannot be rendered, so on error it renders `fallback` (a 3D node, default
 * nothing) and calls `onError` so the scene's DOM slot can show a static fallback instead.
 * A failing scene is isolated: the other scenes and the rest of the page keep working.
 */
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const { sectionType = 'scene', onError } = this.props;
    console.error(`CanvasErrorBoundary (${sectionType}) caught an error:`, error, errorInfo);
    onError?.(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default CanvasErrorBoundary;
