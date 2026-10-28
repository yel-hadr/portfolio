import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// React Three Fiber maps lowercase JSX (<mesh>, <ambientLight>, …) to three.js objects,
// so their props are not DOM attributes. Only ignored in files that render 3D.
const R3F_PROPS = [
  'args',
  'attach',
  'dispose',
  'object',
  'position',
  'position-x',
  'position-y',
  'position-z',
  'rotation',
  'rotation-x',
  'rotation-y',
  'rotation-z',
  'scale',
  'scale-x',
  'scale-y',
  'scale-z',
  'castShadow',
  'receiveShadow',
  'frustumCulled',
  'renderOrder',
  'intensity',
  'geometry',
  'material',
  'visible',
  'vertexColors',
  'groundColor',
  'angle',
  'penumbra',
  'decay',
  'distance',
  'shadow-mapSize',
  'shadow-bias',
  'shadow-camera-near',
  'shadow-camera-far',
  'flatShading',
  'polygonOffset',
  'polygonOffsetFactor',
  'map',
  'transparent',
  'toneMapped',
  'depthWrite',
  'sizeAttenuation',
  'vertexColors',
  'emissive',
  'emissiveIntensity',
  'metalness',
  'roughness',
];

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // JS-only project without PropTypes
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: [
      'src/App.jsx',
      'src/components/canvas/**/*.{js,jsx}',
      // The live demos (own Canvas inside their dialog)
      'src/components/Cub3D/**/*.{js,jsx}',
      'src/components/Fdf/**/*.{js,jsx}',
    ],
    rules: {
      'react/no-unknown-property': ['error', { ignore: R3F_PROPS }],
    },
  },
  // Build plugins, the status monitor and the Vite config run in Node
  {
    files: ['build/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'vite.config.js'],
    languageOptions: { globals: globals.node },
  },
];
