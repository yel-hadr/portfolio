import { useState, useEffect } from 'react';

/**
 * Checks if WebGL is supported in the current browser/device
 * @returns {Object} Object with supported (boolean) and loading (boolean) properties
 */
export const useWebGL = () => {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWebGLSupport = async () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          setSupported(false);
          setLoading(false);
          return;
        }

        // Additional check: verify actual rendering capability
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          
          console.log(`WebGL Renderer: ${renderer}`);
          console.log(`WebGL Vendor: ${vendor}`);
          
          // Detect known problematic configurations
          if (renderer.includes('Google SwiftShader') || renderer.includes('ANGLE')) {
            console.warn('WebGL is running in software mode - performance may be poor');
          }
        }

        // Test basic rendering capability
        const testBuffer = gl.createBuffer();
        if (!testBuffer) {
          setSupported(false);
        } else {
          gl.deleteBuffer(testBuffer);
        }
      } catch (error) {
        console.error('WebGL support check failed:', error);
        setSupported(false);
      } finally {
        setLoading(false);
      }
    };

    checkWebGLSupport();
  }, []);

  return { supported, loading };
};

/**
 * Synchronous WebGL check (for quick checks without hook)
 * @returns {boolean} True if WebGL is supported
 */
export const checkWebGLSync = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
};

export default useWebGL;
