import { Suspense, type ComponentProps } from 'react';
import { BlockSkeleton } from '../../../components/feedback/Skeletons';
import { lazyNamed } from '../../../lib/lazy';
import type { PlaceMap } from './PlaceMap';

const Map = lazyNamed(
  () => import('./PlaceMap'),
  (module) => module.PlaceMap,
);

/**
 * `PlaceMap`, loaded with its map library when first shown (the saved places, the address of an event).
 * @param {ComponentProps<typeof PlaceMap>} props Props of `PlaceMap`.
 * @returns {JSX.Element} Map, or its loading state.
 */
export function LazyPlaceMap(props: ComponentProps<typeof PlaceMap>) {
  return (
    <Suspense fallback={<BlockSkeleton height={8} />}>
      <Map {...props} />
    </Suspense>
  );
}
