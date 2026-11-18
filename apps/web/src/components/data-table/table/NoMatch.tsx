import { FunnelSimpleIcon, FunnelXIcon } from '@phosphor-icons/react';
import { emptyTableFilter } from '@ordo/shared';
import type { DataView } from '../views/use-data-view';
import { EmptyState } from '../../feedback/EmptyState';
import { ActionButton } from '../../actions/ActionButton';

/**
 * What a table shows when its view keeps none of its rows: the search and the filters cleared from it.
 * @param {{ view: DataView<R> }} props Component props.
 * @returns {JSX.Element} Empty state.
 */
export function NoMatch<R>({ view }: { view: DataView<R> }) {
  return (
    <EmptyState
      icon={<FunnelSimpleIcon aria-hidden />}
      message={view.total === 0 ? 'Rien pour le moment.' : 'Aucune ligne ne correspond à cette vue.'}
      action={
        view.total > 0 && (
          <ActionButton priority="secondary" size="xs" icon={<FunnelXIcon aria-hidden />} onClick={() => view.change((current) => ({ ...current, search: '', filter: emptyTableFilter() }))}>
            Effacer la recherche et les filtres
          </ActionButton>
        )
      }
    />
  );
}
