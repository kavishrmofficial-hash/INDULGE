/* The page loads React once from the CDN; every bundled package shares that copy. */
const R = window.React;
export default R;
export const {Children, Component, Fragment, PureComponent, StrictMode, Suspense, cloneElement, createContext,
  createElement, createRef, forwardRef, isValidElement, lazy, memo, startTransition, useCallback, useContext,
  useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect,
  useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version} = R;
