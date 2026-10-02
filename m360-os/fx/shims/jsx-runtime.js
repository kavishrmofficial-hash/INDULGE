/* The automatic JSX runtime on top of the page's React. */
const R = window.React;
const build = (type, props, key) => {
  const p = props || {};
  const {children, ...rest} = p;
  if (key !== undefined) rest.key = key;
  if (children === undefined) return R.createElement(type, rest);
  if (Array.isArray(children)) return R.createElement(type, rest, ...children);
  return R.createElement(type, rest, children);
};
export const jsx = build;
export const jsxs = build;
export const jsxDEV = build;
export const Fragment = R.Fragment;
