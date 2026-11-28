import { ActionButton } from './ActionButton';
import { OCCURRENCE_ACTIONS, type OccurrenceAction } from './occurrence-entries';

/**
 * Button of an action of an occurrence (a panel without « … » menu), its words and icon the same everywhere; « Supprimer » in red
 * (« Annuler » can be restored).
 * @param {{ action: OccurrenceAction, onClick: () => void, loading?: boolean }} props Action, run, running (optional).
 * @returns {JSX.Element} Button.
 */
export function OccurrenceButton({ action, onClick, loading = false }: { action: OccurrenceAction; onClick: () => void; loading?: boolean }) {
  const { label, icon } = OCCURRENCE_ACTIONS[action];
  // « Supprimer » in red; « Annuler » can be restored.
  return (
    <ActionButton danger={OCCURRENCE_ACTIONS[action].danger} icon={icon} loading={loading} onClick={onClick}>
      {label}
    </ActionButton>
  );
}
