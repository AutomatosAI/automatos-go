module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: @clerk/shared ships `import.meta` in its
    // .mjs build, which Hermes doesn't support natively — this transpiles it.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    // Reanimated 4 moved the worklets Babel transform into the separate
    // react-native-worklets package (react-native-reanimated/plugin was removed).
    plugins: ['react-native-worklets/plugin'],
  };
};
