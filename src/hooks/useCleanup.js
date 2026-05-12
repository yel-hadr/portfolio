import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * Disposes a Three.js material and all its textures
 */
const disposeMaterial = (material) => {
  if (!material) return;
  
  material.dispose();
  
  // Dispose all texture properties
  for (const key in material) {
    const value = material[key];
    if (value && typeof value === 'object' && value.isTexture) {
      value.dispose();
    }
  }
};

/**
 * Recursively disposes a Three.js object and all its children
 */
const disposeObject = (object) => {
  if (!object) return;

  object.traverse((child) => {
    if (child.isMesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      // Dispose materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => disposeMaterial(m));
        } else {
          disposeMaterial(child.material);
        }
      }
    }
    
    // Handle skinned meshes
    if (child.isSkinnedMesh && child.skeleton) {
      child.skeleton.dispose();
    }
  });
};

/**
 * React hook for automatic cleanup of Three.js objects
 * @param {React.RefObject} ref - Ref containing the Three.js object to cleanup
 * @param {Array} dependencies - Optional dependencies array for the effect
 */
export const useCleanup = (ref, dependencies = []) => {
  useEffect(() => {
    return () => {
      if (ref.current) {
        disposeObject(ref.current);
        
        // If it's a GLTF scene wrapper, also cleanup the scene
        if (ref.current.scene) {
          disposeObject(ref.current.scene);
        }
      }
    };
  }, dependencies);
};

/**
 * Utility function to manually dispose a GLTF scene
 * Use this with the dispose prop on primitive elements
 */
export const disposeGLTFScene = (object) => {
  if (!object) return;
  disposeObject(object);
};

export { disposeObject, disposeMaterial };
