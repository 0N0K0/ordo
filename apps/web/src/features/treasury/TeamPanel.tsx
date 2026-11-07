import { ActionIcon, Avatar, Badge, Button, ColorInput, ColorSwatch, Group, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { EVERYDAY_CONTEXT, treasuryContextPeriodSchema, treasuryContextSchema } from '@ordo/shared';
import { CalendarBlankIcon, PlusIcon, TagSimpleIcon, UserMinusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useActiveWorkspace } from '../workspaces/api';
import { useTreasurySettings, useTreasuryTeamMutations, type TreasuryContext, type TreasuryContextPeriod } from './api';
import { confirmDeletion } from './confirm-deletion';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Day in words.
 * @param {unknown} day YYYY-MM-DD.
 * @returns {string} "12 août 2026".
 */
const formatDay = (day: unknown) => dayFormat.format(new Date(`${String(day)}T00:00:00Z`));

/**
 * Members of the team (professional workspace) or household (personal one): "Moi" always is one; a member is a
 * contributor (an existing one, or a new one created with their name). A member removed stays a contributor.
 * @returns {JSX.Element} Section.
 */
function Members() {
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const { perso } = useActiveWorkspace();
  const { addMember, removeMember } = useTreasuryTeamMutations();
  const [name, setName] = useState('');
  const members = settings?.treasuryMembers ?? [];
  const memberIds = new Set(members.map((member) => member.id));
  const others = (context?.contributors ?? []).filter((contributor) => !memberIds.has(contributor.id));
  const onError = (error: Error) => notifyError(error.message);
  const team = perso ? 'Foyer' : 'Équipe';

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Title order={3} size="h5">
          {team}
        </Title>
        <Text size="xs" c="dimmed">
          Les mouvements se répartissent entre les membres. Chaque membre est aussi un contributeur (tâches, projets, agenda) ; retiré, il le reste.
        </Text>
        <Table verticalSpacing={4}>
          <Table.Tbody>
            {members.map((member) => (
              <Table.Tr key={member.id}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={member.avatarUrl} size="sm" name={member.name} color="initials" />
                    <Text size="sm">{member.name}</Text>
                    {member.isMe && (
                      <Badge size="xs" variant="light">
                        Moi
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td w={1}>
                  {!member.isMe && (
                    <Tooltip label={`Retirer du ${team.toLowerCase()} (reste contributeur)`}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Retirer ${member.name}`}
                        loading={removeMember.isPending && removeMember.variables === member.id}
                        onClick={() => removeMember.mutate(member.id, { onSuccess: () => notifySuccess(`${member.name} n’est plus membre.`), onError })}
                      >
                        <UserMinusIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Select
            size="xs"
            aria-label="Ajouter un contributeur existant"
            placeholder={others.length ? 'Ajouter un contributeur…' : 'Tous les contributeurs sont membres'}
            disabled={!others.length}
            searchable
            data={others.map((contributor) => ({ value: contributor.id, label: contributor.name }))}
            value={null}
            onChange={(contributorId) => contributorId && addMember.mutate({ contributorId }, { onSuccess: () => notifySuccess('Membre ajouté.'), onError })}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              addMember.mutate({ name: name.trim() }, { onSuccess: () => (notifySuccess('Membre ajouté.'), setName('')), onError });
            }}
          >
            <Group gap={4} wrap="nowrap">
              <TextInput size="xs" style={{ flex: 1 }} aria-label="Nom d’un nouveau membre" placeholder="Ou un nouveau membre…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
              <Tooltip label="Ajouter (crée le contributeur)">
                <ActionIcon type="submit" variant="light" size="input-xs" aria-label="Ajouter le nouveau membre" disabled={!name.trim()} loading={addMember.isPending}>
                  <PlusIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          </form>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

/**
 * Context form: name and color.
 * @param {{ context?: TreasuryContext, onDone: (createdId?: string) => void }} props Component props; the form closes with the id of the context created.
 * @returns {JSX.Element} Form.
 */
export function ContextForm({ context, onDone }: { context?: TreasuryContext; onDone: (createdId?: string) => void }) {
  const { saveContext } = useTreasuryTeamMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<{ name: string; color: string }>({ initialValues: { name: context?.name ?? '', color: context?.color ?? swatches[0] }, schema: treasuryContextSchema });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveContext.mutate(
          { id: context?.id ?? null, input },
          {
            onSuccess: (id) => {
              notifySuccess(context ? 'Contexte modifié.' : 'Contexte créé.');
              onDone(context ? undefined : id);
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required data-autofocus placeholder="Vacances, Rentrée…" {...form.getInputProps('name')} />
        <ColorInput label="Couleur" required format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => onDone()}>
            Annuler
          </Button>
          <Button type="submit" loading={saveContext.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Planned period form: context, first and last days, note.
 * @param {{ period?: TreasuryContextPeriod, contexts: TreasuryContext[], onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function PeriodForm({ period, contexts, onDone }: { period?: TreasuryContextPeriod; contexts: TreasuryContext[]; onDone: () => void }) {
  const { saveContextPeriod } = useTreasuryTeamMutations();
  const form = useAppForm<{ contextId: string; startDate: string; endDate: string; note: string | null }>({
    initialValues: {
      contextId: period?.contextId ?? contexts[0]?.id ?? '',
      startDate: period ? String(period.startDate) : '',
      endDate: period ? String(period.endDate) : '',
      note: period?.note ?? null,
    },
    schema: treasuryContextPeriodSchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveContextPeriod.mutate(
          { id: period?.id ?? null, input: { ...input, note: input.note || null } },
          { onSuccess: () => (notifySuccess(period ? 'Période modifiée.' : 'Période planifiée.'), onDone()), onError: (error) => showFormError(form, error) },
        ),
      )}
    >
      <Stack gap="sm">
        <Select label="Contexte" required allowDeselect={false} data={contexts.map((item) => ({ value: item.id, label: item.name }))} {...form.getInputProps('contextId')} />
        <SimpleGrid cols={2} spacing="sm">
          <DatePickerInput
            label="Du"
            required
            valueFormat="D MMM YYYY"
            {...form.getInputProps('startDate')}
            // The end follows a start set after it.
            onChange={(date) => form.setValues({ startDate: date ?? '', ...(date && (!form.values.endDate || form.values.endDate < date) ? { endDate: date } : {}) })}
          />
          <DatePickerInput label="Au" required valueFormat="D MMM YYYY" minDate={form.values.startDate || undefined} {...form.getInputProps('endDate')} />
        </SimpleGrid>
        <TextInput label="Note" placeholder="Facultative" {...form.getInputProps('note')} value={form.values.note ?? ''} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={saveContextPeriod.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

type Dialog = { kind: 'context'; context?: TreasuryContext } | { kind: 'period'; period?: TreasuryContextPeriod } | null;

/**
 * Contexts of spending (not in a tree; a line without context is everyday spending) and the periods they are
 * planned for: the lines of the entries dated in a period get its context proposed.
 * @returns {JSX.Element} Sections.
 */
function Contexts() {
  const { data: settings } = useTreasurySettings();
  const { deleteContext, deleteContextPeriod } = useTreasuryTeamMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const contexts = settings?.treasuryContexts ?? [];
  const periods = settings?.treasuryContextPeriods ?? [];
  const contextById = new Map(contexts.map((item) => [item.id, item]));
  const onError = (error: Error) => notifyError(error.message);
  const close = () => setDialog(null);

  return (
    <>
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="xs">
          <Title order={3} size="h5">
            Contextes
          </Title>
          <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'context' })}>
            Contexte
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="xs">
          Une même dépense ne compte pas pareil en vacances ou au quotidien. Une ligne sans contexte est du « {EVERYDAY_CONTEXT} ».
        </Text>
        {contexts.length === 0 ? (
          <Group gap="xs" py="xs">
            <TagSimpleIcon aria-hidden />
            <Text size="sm" c="dimmed">
              Aucun contexte : tout est du {EVERYDAY_CONTEXT.toLowerCase()}.
            </Text>
          </Group>
        ) : (
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {contexts.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <ColorSwatch color={item.color} size={14} />
                      <Text size="sm">{item.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td w={1}>
                    <Group gap={2} wrap="nowrap">
                      <Button size="compact-xs" variant="subtle" onClick={() => setDialog({ kind: 'context', context: item })}>
                        Modifier
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          confirmDeletion(
                            'Supprimer le contexte',
                            `« ${item.name} » sera supprimé définitivement avec ses périodes planifiées. Les lignes qui l’avaient deviendront du « ${EVERYDAY_CONTEXT} ».`,
                            () => deleteContext.mutate(item.id, { onSuccess: () => notifySuccess('Contexte supprimé.'), onError }),
                          )
                        }
                      >
                        Supprimer
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="xs">
          <Title order={3} size="h5">
            Contextes planifiés
          </Title>
          <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} disabled={!contexts.length} onClick={() => setDialog({ kind: 'period' })}>
            Période
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="xs">
          Les lignes des mouvements datés dans une période prennent son contexte (modifiable). Changer une période ne modifie pas les lignes déjà enregistrées.
        </Text>
        {periods.length === 0 ? (
          <Group gap="xs" py="xs">
            <CalendarBlankIcon aria-hidden />
            <Text size="sm" c="dimmed">
              {contexts.length ? 'Aucune période planifiée.' : 'Créez d’abord un contexte.'}
            </Text>
          </Group>
        ) : (
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {periods.map((period) => {
                const item = contextById.get(period.contextId);
                return (
                  <Table.Tr key={period.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <ColorSwatch color={item?.color ?? 'gray'} size={14} />
                        <Text size="sm">{item?.name}</Text>
                      </Group>
                      {period.note && (
                        <Text size="xs" c="dimmed">
                          {period.note}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatDay(period.startDate)} → {formatDay(period.endDate)}
                      </Text>
                    </Table.Td>
                    <Table.Td w={1}>
                      <Group gap={2} wrap="nowrap">
                        <Button size="compact-xs" variant="subtle" onClick={() => setDialog({ kind: 'period', period })}>
                          Modifier
                        </Button>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            confirmDeletion(
                              'Supprimer la période',
                              `La période « ${item?.name ?? ''} » du ${formatDay(period.startDate)} au ${formatDay(period.endDate)} sera supprimée. Les lignes déjà enregistrées gardent leur contexte.`,
                              () => deleteContextPeriod.mutate(period.id, { onSuccess: () => notifySuccess('Période supprimée.'), onError }),
                            )
                          }
                        >
                          Supprimer
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={dialog !== null}
        onClose={close}
        title={dialog?.kind === 'context' ? (dialog.context ? 'Modifier le contexte' : 'Nouveau contexte') : dialog?.period ? 'Modifier la période' : 'Planifier un contexte'}
      >
        {dialog?.kind === 'context' && <ContextForm context={dialog.context} onDone={close} />}
        {dialog?.kind === 'period' && <PeriodForm period={dialog.period} contexts={contexts} onDone={close} />}
      </Modal>
    </>
  );
}

/**
 * Team or household, contexts and their planned periods: how the entries are split.
 * @returns {JSX.Element} Sections.
 */
export function TeamPanel() {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <Members />
      <Contexts />
    </SimpleGrid>
  );
}
