import React from 'react';
import { motion } from 'framer-motion';

const WebGLFallback = ({ onRetry }) => {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md text-center"
      >
        <div className="mb-6">
          <svg 
            className="w-20 h-20 mx-auto mb-4 text-red-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
          <h1 className="text-3xl font-bold mb-2">Hardware Acceleration Required</h1>
          <p className="text-gray-300">
            Our 3D portfolio requires WebGL support which isn't available on your current device or browser.
          </p>
        </div>

        <div className="p-6 bg-slate-800 rounded-xl border border-white/10 mb-6 text-left">
          <h3 className="text-xl font-semibold mb-3 text-green-400">What you're missing:</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Interactive 3D computer model showcasing technical skills</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Real-time animated Earth visualization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Dynamic technology icon showcase with 3D effects</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <h4 className="font-semibold mb-2">Try these solutions:</h4>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>Enable hardware acceleration in your browser settings</li>
              <li>Update your graphics drivers</li>
              <li>Try a different browser (Chrome, Firefox, Edge)</li>
              <li>Check if WebGL is enabled in your browser</li>
            </ol>
          </div>

          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
            >
              Retry Detection
            </button>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-sm text-gray-400">
            You can still view my resume and contact information below.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default WebGLFallback;
