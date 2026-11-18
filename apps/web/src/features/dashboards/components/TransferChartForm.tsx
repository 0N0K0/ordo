import { Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { formCallbacks } from '../../../lib/form';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useDashboardMutations, useDashboards, type DashboardChart } from '../api';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { FormActions } from '../../../components/dialogs/FormActions';
import { unarchived } from '../../../lib/archive';

const GENERAL = 'general';

interface TransferChartFormProps {
  chart: DashboardChart;
  /** Project of the dashboard the chart is on, or null for the general dashboards. */
  projectId: string | null;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Moves a chart to another dashboard: the general dashboards or those of a project (a project without one gets
 * a new dashboard; the archived ones are not offered). The chart leaves its dashboard and is then computed on the scope of the new one.
 * @param {TransferChartFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TransferChartForm({ chart, projectId, context, onDone }: TransferChartFormProps) {
  const [destination, setDestination] = useState<string>(projectId ?? GENERAL);
  const targetProject = destination === GENERAL ? null : destination;
  const { data: dashboards } = useDashboards(targetProject);
  // An archived dashboard takes no chart.
  const choices = unarchived(dashboards ?? []).filter((dashboard) => !dashboard.charts.some((item) => item.id === chart.id));
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const { transferChart } = useDashboardMutations();
  const chosen = choices.find((dashboard) => dashboard.id === dashboardId)?.id ?? choices[0]?.id ?? null;
  const destinationProps = treeSelectProps([
    { value: GENERAL, label: 'Tableau de bord général (tous les projets)', nodeLabel: 'Tableau de bord général (tous les projets)', depth: 0, parent: null },
    ...context.projectOptions(unarchived(context.projects)),
  ]);

  return (
    <Stack gap="md">
      <Select
        label="Destination"
        searchable
        allowDeselect={false}
        {...destinationProps}
        value={destination}
        onChange={(value) => {
          if (!value) return;
          setDestination(value);
          setDashboardId(null);
        }}
        data-autofocus
      />
      {choices.length > 0 ? (
        <Select label="Tableau de bord" allowDeselect={false} data={choices.map((dashboard) => ({ value: dashboard.id, label: dashboard.label }))} value={chosen} onChange={setDashboardId} />
      ) : (
        dashboards && (
          <Text size="sm" c="dimmed">
            {targetProject
              ? 'Ce projet n’a pas encore de tableau de bord : un tableau « Tableau de bord » sera créé.'
              : 'Aucun autre tableau de bord général : un tableau « Tableau de bord » sera créé.'}
          </Text>
        )
      )}
      <Text size="xs" c="dimmed">
        Le diagramme quitte son tableau de bord actuel.{targetProject ? ' Il ne comptera plus que le projet et ses sous-projets.' : ' Il comptera tous les projets.'}
      </Text>
      <FormActions
        onCancel={onDone}
        submitLabel="Déplacer"
        loading={transferChart.isPending}
        disabled={!dashboards}
        onSubmit={() => transferChart.mutate({ id: chart.id, dashboardId: chosen, projectId: targetProject }, formCallbacks(null, 'Diagramme déplacé.', onDone))}
      />
    </Stack>
  );
}
