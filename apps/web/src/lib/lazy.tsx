import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Component loaded when it is first shown, with its own code and the libraries only it uses (a page, the map, the mail
 * editor…): the app starts without them. Rendered under a `Suspense` giving its loading state.
 * @template M, P
 * @param {() => Promise<M>} load Imports the module of the component (`() => import('./Thing')`).
 * @param {(module: M) => ComponentType<P>} pick Component of the module.
 * @returns {LazyExoticComponent<ComponentType<P>>} Component.
 */
export function lazyNamed<M, P>(load: () => Promise<M>, pick: (module: M) => ComponentType<P>): LazyExoticComponent<ComponentType<P>> {
  // eslint-disable-next-line no-restricted-syntax -- lazyNamed itself.
  return lazy(async () => ({ default: pick(await load()) }));
}
