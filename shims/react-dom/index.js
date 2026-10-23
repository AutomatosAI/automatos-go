// Shim for react-dom in a React Native context.
// Clerk imports react-dom but doesn't use DOM APIs on mobile.
module.exports = {
  createPortal: (children) => children,
  flushSync: (fn) => fn(),
  unstable_batchedUpdates: (fn) => fn(),
  findDOMNode: () => null,
  render: () => {},
  unmountComponentAtNode: () => {},
  version: '19.0.0',
};
