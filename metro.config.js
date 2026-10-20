// Metro config — Expo SDK 54.
//
// Metro 0.83 enables package.json "exports" resolution by default, so the
// @clerk/* subpath imports (@clerk/react/internal, etc.) resolve natively — no
// manual subpath map needed.
//
// IMPORTANT: do NOT hand-map only the Clerk subpaths. Forcing @clerk/react/internal
// to its .mjs build while the main @clerk/react entry resolves natively (.cjs)
// loads TWO copies of @clerk/react → two React context instances → the runtime
// error "ClerkLoaded can only be used within <ClerkProvider>". Letting native
// resolution handle every Clerk import uniformly keeps it a single instance.
//
// The react-dom shim stays: Clerk imports react-dom but never touches DOM APIs on
// native, so it points at a no-op shim.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-dom': path.resolve(__dirname, 'shims/react-dom'),
  'react-dom/client': path.resolve(__dirname, 'shims/react-dom/client.js'),
};

module.exports = config;
