import * as THREE from 'three';

/**
 * Checks if WebGL is available in the current browser environment.
 * @returns {boolean} True if WebGL is supported, false otherwise.
 */
export const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
};

/**
 * Generates a static fallback image URL based on the section type.
 * In a real production app, you would replace these with actual pre-rendered PNGs/WebP of your 3D scenes.
 * @param {string} type - The type of section ('hero', 'earth', 'ball')
 * @returns {string} - Placeholder image URL (using placehold.co for demo, replace with assets)
 */
export const getFallbackImage = (type) => {
  const colors = {
    hero: '1e293b', // Slate 800
    earth: '0f172a', // Slate 900
    ball: '1e293b',
  };
  
  const text = {
    hero: '3D+Desktop+Setup',
    earth: 'Interactive+Globe',
    ball: 'Project+Thumbnail',
  };

  return `https://placehold.co/600x400/${colors[type] || '1e293b'}/FFFFFF?text=${text[type] || '3D+Content'}`;
};
