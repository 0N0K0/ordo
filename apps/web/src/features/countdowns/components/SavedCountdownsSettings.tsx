import { Badge } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useSavedCountdownMutations, useSavedCountdowns } from '../api';
import { useSavedCountdownItems } from '../hooks/use-saved-countdowns';

/**
 * Settings list « Minuteurs enregistrés » of the workspace (in the settings of the page « Alarmes »): name, color,
 * image, duration and ringtone of each, added, edited, reordered, archived, deleted as every settings list.
 * @returns {JSX.Element} List.
 */
export function SavedCountdownsSettings() {
  const { data, isPending } = useSavedCountdowns();
  const { remove } = useSavedCountdownMutations();
  return (
    <SettingsList
      title="Minuteurs enregistrés"
      description="Lancés en un clic (« Œufs durs », « Lessive »…) : depuis la liste des minuteurs, « Ajouter › Minuteur », et les tâches, routines, évènements et fiches qui les citent. Ceux de cet espace."
      noun="le minuteur"
      items={data ?? []}
      loading={isPending}
      renderBadges={(saved) => (
        <Badge size="xs" variant="light" color="gray">
          {formatDuration(saved.minutes * 60)}
        </Badge>
      )}
      deleteMessage={(_saved, path) => `« ${path} » sera supprimé définitivement et retiré des tâches, routines, évènements et fiches qui le lancent ; les minuteurs en cours continuent.`}
      remove={(id) => remove.mutateAsync({ id })}
      {...useSavedCountdownItems()}
    />
  );
}
