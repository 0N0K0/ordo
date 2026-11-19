import { Suspense, type ComponentProps } from 'react';
import { BlockSkeleton } from '../../../components/feedback/Skeletons';
import { lazyNamed } from '../../../lib/lazy';
import type { RichEditor } from './RichEditor';

const Editor = lazyNamed(
  () => import('./RichEditor'),
  (module) => module.RichEditor,
);

/**
 * `RichEditor`, loaded with its editing library when first shown (a mail written, a signature).
 * @param {ComponentProps<typeof RichEditor>} props Props of `RichEditor`.
 * @returns {JSX.Element} Editor, or its loading state.
 */
export function LazyRichEditor(props: ComponentProps<typeof RichEditor>) {
  return (
    <Suspense fallback={<BlockSkeleton height={8} />}>
      <Editor {...props} />
    </Suspense>
  );
}
