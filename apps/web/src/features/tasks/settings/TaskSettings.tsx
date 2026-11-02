import { Select, Stack } from "@mantine/core";
import type { TaskStatusCategory } from "@ordo/shared";
import { notifyError } from "../../../lib/notify";
import { LabelManager } from "../../../components/settings/LabelManager";
import { useTaskLabelMutations, useTasksData, type Task } from "../api";

const CATEGORY_OPTIONS: { value: TaskStatusCategory; label: string }[] = [
  { value: "TODO", label: "À faire" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "DONE", label: "Terminé" },
  { value: "CANCELLED", label: "Annulé" },
];

/**
 * Counts the tasks using each value of a field.
 * @param {Task[]} tasks Tasks.
 * @param {(task: Task) => string[]} pick Ids used by a task.
 * @returns {Map<string, number>} Count per id.
 */
function usageOf(
  tasks: Task[],
  pick: (task: Task) => string[],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const task of tasks)
    for (const id of pick(task)) usage.set(id, (usage.get(id) ?? 0) + 1);
  return usage;
}

/**
 * Settings of tasks: statuses (with their category), priorities and types.
 * @returns {JSX.Element} Settings.
 */
export function TaskSettings() {
  const { data } = useTasksData();
  const statuses = useTaskLabelMutations("status");
  const priorities = useTaskLabelMutations("priority");
  const types = useTaskLabelMutations("type");
  const tasks = data?.tasks ?? [];
  const byPosition = <T extends { position: number }>(items: T[] = []) =>
    [...items].sort((a, b) => a.position - b.position);
  const statusList = byPosition(data?.taskStatuses);

  return (
    <Stack gap="lg">
      <LabelManager
        title="Statuts de tâche"
        description="La catégorie donne son sens au statut quel que soit son nom (filtres, tâches « en cours » de l’accueil). C’est l’état ouvert / fermé de la tâche, et non son statut, qui dit si elle est terminée."
        noun="le statut"
        usageNoun="tâches"
        labels={statusList}
        usage={usageOf(tasks, (task) => (task.statusId ? [task.statusId] : []))}
        create={statuses.create}
        update={statuses.update}
        remove={statuses.remove}
        move={statuses.move}
        renderExtra={(label) => (
          <Select
            aria-label={`Catégorie du statut ${label.name}`}
            data={CATEGORY_OPTIONS}
            value={
              statusList.find((status) => status.id === label.id)?.category ??
              "TODO"
            }
            allowDeselect={false}
            onChange={(category) =>
              category &&
              statuses.update.mutate(
                {
                  id: label.id,
                  input: { category: category as TaskStatusCategory },
                },
                { onError: (error) => notifyError(error.message) },
              )
            }
            w={130}
          />
        )}
      />
      <LabelManager
        title="Priorités"
        description="L’ordre est celui des listes de sélection et du tri par priorité."
        noun="la priorité"
        usageNoun="tâches"
        labels={byPosition(data?.taskPriorities)}
        usage={usageOf(tasks, (task) =>
          task.priorityId ? [task.priorityId] : [],
        )}
        create={priorities.create}
        update={priorities.update}
        remove={priorities.remove}
        move={priorities.move}
      />
      <LabelManager
        title="Types de tâche"
        description="Bug, fonctionnalité, amélioration…"
        noun="le type"
        usageNoun="tâches"
        labels={byPosition(data?.taskTypes)}
        usage={usageOf(tasks, (task) => (task.typeId ? [task.typeId] : []))}
        create={types.create}
        update={types.update}
        remove={types.remove}
        move={types.move}
      />
    </Stack>
  );
}
