import { countBy } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useRoutinesData } from '../../routines/api';
import { useTasksData } from '../api';
import { useTaskLabelItems } from '../hooks/use-label-items';

/** What uses a priority or a type: the tasks and the routines (the lists are shared by both). */
const ACTIVITY_USAGE = { one: 'de la tâche ou de la routine', many: 'tâches et routines' };

/**
 * Settings lists « Priorités » and « Types », shared by the tasks and the routines (their uses count both): in the
 * settings of the tasks and in those of the routines.
 * @returns {JSX.Element} The two lists.
 */
export function PriorityTypeSettings() {
  const { data } = useTasksData();
  const { data: routinesData } = useRoutinesData();
  const priorities = useTaskLabelItems('priority');
  const types = useTaskLabelItems('type');
  const activities = [...(data?.tasks ?? []), ...(routinesData?.routines ?? [])];
  return (
    <>
      <SettingsList
        {...priorities}
        title="Priorités"
        description="Communes aux tâches et aux routines. L’ordre est celui des listes de sélection et du tri par priorité."
        noun="la priorité"
        feminine
        usageNoun={ACTIVITY_USAGE}
        items={data?.taskPriorities ?? []}
        usage={countBy(activities, (item) => (item.priorityId ? [item.priorityId] : []))}
      />
      <SettingsList
        {...types}
        title="Types"
        description="Communs aux tâches et aux routines : bug, fonctionnalité, ménage, courses…"
        noun="le type"
        usageNoun={ACTIVITY_USAGE}
        items={data?.taskTypes ?? []}
        usage={countBy(activities, (item) => (item.typeId ? [item.typeId] : []))}
      />
    </>
  );
}
