// Shim for react-dom/client in a React Native context.
module.exports = {
  createRoot: () => ({ render: () => {}, unmount: () => {} }),
  hydrateRoot: () => ({ render: () => {}, unmount: () => {} }),
};
