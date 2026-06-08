const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Zustand v5 tiene dos versiones de middleware:
//   esm/middleware.mjs  → usa import.meta (rompe el bundler web de Metro)
//   middleware.js       → CommonJS, sin import.meta (funciona en todos lados)
// Metro para web resuelve la versión ESM por defecto, lo que causa el error
// "Cannot use 'import.meta' outside a module". Forzamos la CJS aquí.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
