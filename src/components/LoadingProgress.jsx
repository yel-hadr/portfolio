import React from 'react';

/**
 * LoadingProgress - A sleek, technical loading bar for 3D assets.
 * Displays progress percentage with a modern DevOps/SaaS aesthetic.
 */
const LoadingProgress = ({ progress }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950 z-50">
      <div className="w-full max-w-md px-8">
        <div className="mb-4 flex justify-between items-end">
          <h2 className="text-white font-mono text-lg">Loading System Assets</h2>
          <span className="text-cyan-400 font-mono text-xl font-bold">{progress.toFixed(0)}%</span>
        </div>
        
        {/* Progress Bar Track */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Loading Dots Animation */}
        <div className="mt-4 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        <p className="text-slate-500 text-xs font-mono mt-6 text-center">
          Initializing WebGL Context • Loading Textures • Compiling Shaders
        </p>
      </div>
    </div>
  );
};

export default LoadingProgress;
