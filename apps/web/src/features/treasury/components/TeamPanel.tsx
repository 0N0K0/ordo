import { IconAction } from '../../../components/actions/IconAction';
import { NO_SUGGESTIONS, NO_TARGETS } from '../../../components/markdown/remark-references';
import { ColorField } from '../../../components/inputs/ColorField';
import { openFormPanel } from '../../../components/panels/panels';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PersonRow } from '../../../components/people/people-rows';
import { itemSelectProps } from '../../../components/items/item-look';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';

import { Badge, Fieldset, Group, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { mapById, EVERYDAY_CONTEXT, treasuryContextPeriodSchema, treasuryContextSchema, treasuryRelationSchema, agreed } from '@ordo/shared';
import { CalendarBlankIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserMinusIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { archiveEntry, unarchived, useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { useState } from 'react';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { toastCallbacks } from '../../../lib/notify';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useColorSwatches } from '../../../lib/use-color-swatches';
import { useActiveWorkspace } from '../../workspaces/api';
import { treasuryKey, useTreasurySettings, useTreasuryTeamMutations, type TreasuryContext, type TreasuryContextPeriod, type TreasuryRelation } from '../api';
import * as fmt from '../../../lib/format';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';
import { personOptionRenderer } from '../../../components/people/person-option';
import { relationWords } from '../../../components/people/people-options';

/**
 * Members of the team (professional workspace) or household (personal one): "Moi" always is one; a member is a
 * contributor (an existing one, or a new one created with their name). A member removed stays a contributor. An
 * archived member is hidden unless asked, and archived contributors are not offered as new members.
 * @returns {JSX.Element} Section.
 */
export function TeamMembers() {
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const { perso } = useActiveWorkspace();
  const { addMember, removeMember } = useTreasuryTeamMutations();
  const [name, setName] = useState('');
  const setArchived = useSetArchived('CONTRIBUTOR');
  // Names and avatars as the contributors have them now (renamed or removed in the list of contributors).
  const contributorById = mapById(context?.contributors ?? []);
  const members = (settings?.treasuryMembers ?? [])
    .filter((member) => !context || contributorById.has(member.id))
    .map((member) => ({
      ...member,
      archived: contributorById.get(member.id)?.archived ?? false,
      ...(contributorById.get(member.id) ? { name: contributorById.get(member.id)!.name, avatarUrl: contributorById.get(member.id)!.avatarUrl } : {}),
    }));
  const memberIds = new Set(members.map((member) => member.id));
  const { shown: shownMembers, toggle: membersToggle } = useArchivedToggle(members);
  // A relation is not a member too.
  const relationContributors = new Set((settings?.treasuryRelations ?? []).map((relation) => relation.contributorId));
  const others = unarchived(context?.contributors ?? []).filter((contributor) => !memberIds.has(contributor.id) && !relationContributors.has(contributor.id));
  const team = perso ? 'Foyer' : 'Équipe';

  return (
    <SettingsSection
      title={team}
      description="Les mouvements se répartissent entre les membres. Chaque membre est aussi un contributeur (tâches, projets, agenda) ; retiré, il le reste."
      actions={<ShowArchivedSwitch {...membersToggle} />}
    >
      <Table verticalSpacing={4}>
        <Table.Tbody>
          {shownMembers.map((member) => (
            <Table.Tr key={member.id}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <PersonRow
                    name={member.name}
                    avatarUrl={member.avatarUrl}
                    badges={
                      <>
                        {member.isMe && (
                          <Badge size="xs" variant="light">
                            Moi
                          </Badge>
                        )}
                        {member.archived && <ArchivedBadge size="xs" />}
                      </>
                    }
                  />
                </Group>
              </Table.Td>
              <Table.Td w={1}>
                {!member.isMe && (
                  <InlineActions
                    name={member.name}
                    items={[
                      archiveEntry({ archived: member.archived, type: 'Membre', label: member.name }, setArchived, member.id),
                      {
                        label: 'Retirer',
                        hint: `Retirer du ${team.toLowerCase()} (reste contributeur)`,
                        icon: <UserMinusIcon aria-hidden />,
                        onClick: () => removeMember.mutate(member.id, toastCallbacks(`${member.name} n’est plus membre.`)),
                      },
                    ]}
                  />
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
          data={others.map((item) => ({ value: item.id, label: item.name }))}
          renderOption={personOptionRenderer(contributorById)}
          value={null}
          onChange={(contributorId) => contributorId && addMember.mutate({ contributorId }, toastCallbacks('Membre ajouté.'))}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            addMember.mutate(
              { name: name.trim() },
              formCallbacks(null, 'Membre ajouté.', () => setName('')),
            );
          }}
        >
          <Group gap={4} wrap="nowrap">
            <TextInput size="xs" style={{ flex: 1 }} aria-label="Nom d’un nouveau membre" placeholder="Ou un nouveau membre…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <IconAction
              label="Ajouter"
              hint="Ajouter (crée le contributeur)"
              type="submit"
              variant="light"
              size="input-xs"
              aria-label="Ajouter le nouveau membre"
              disabled={!name.trim()}
              loading={addMember.isPending}
            >
              <PlusIcon aria-hidden />
            </IconAction>
          </Group>
        </form>
      </SimpleGrid>
    </SettingsSection>
  );
}

/**
 * New context, from a select of a line: label and color (a context is changed in the list of the contexts).
 * @param {{ label?: string, onDone: (createdId?: string) => void }} props Component props (the label typed in the select); the form closes with the id of the context created.
 * @returns {JSX.Element} Form.
 */
export function ContextForm({ label = '', onDone }: { label?: string; onDone: (createdId?: string) => void }) {
  const { saveContext } = useTreasuryTeamMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<{ label: string; color: string }>({ initialValues: { label, color: swatches[0] }, schema: treasuryContextSchema });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveContext.mutate(
          { id: null, input },
          formCallbacks(form, 'Contexte créé.', (id: string) => onDone(id)),
        ),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Libellé" required data-autofocus placeholder="Vacances, Rentrée…" {...form.getInputProps('label')} />
        <ColorField required {...form.getInputProps('color')} />
        <FormActions onCancel={() => onDone()} submitLabel="Créer" loading={saveContext.isPending} />
      </Stack>
    </form>
  );
}

/** Values of a planned period. */
type PeriodValues = { contextId: string; startDate: string; endDate: string; note: string | null };

/**
 * Values of a planned period (a new one: the first context, no days).
 * @param {TreasuryContextPeriod | undefined} period Period, as the cache holds it.
 * @param {TreasuryContext[]} contexts Contexts.
 * @returns {PeriodValues} Values.
 */
const periodValues = (period: TreasuryContextPeriod | undefined, contexts: TreasuryContext[]): PeriodValues => ({
  contextId: period?.contextId ?? unarchived(contexts)[0]?.id ?? '',
  startDate: period ? period.startDate : '',
  endDate: period ? period.endDate : '',
  note: period?.note ?? null,
});

/**
 * Planned period form: context, first and last days, note. A new period is a form with « Planifier »; an existing one,
 * its panel, saves each field as soon as it changes (the note on leaving it, decision D22, `useFieldSave`), the one of
 * the cache followed; read only while its context is archived.
 * @param {{ period?: TreasuryContextPeriod, contexts: TreasuryContext[], onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function PeriodForm({ period, contexts, onDone }: { period?: TreasuryContextPeriod; contexts: TreasuryContext[]; onDone: () => void }) {
  const { saveContextPeriod } = useTreasuryTeamMutations();
  const { data: settings } = useTreasurySettings();
  const base = useAppForm<PeriodValues>({ initialValues: periodValues(period, contexts), schema: treasuryContextPeriodSchema });
  const current = period && (settings?.treasuryContextPeriods.find((item) => item.id === period.id) ?? period);
  const readOnly = Boolean(current && (settings?.treasuryContexts ?? contexts).find((item) => item.id === current.contextId)?.archived);
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: period ? (_changes, input) => saveContextPeriod.mutateAsync({ id: period.id, input: { ...input, note: input.note || null } }) : null,
    schema: treasuryContextPeriodSchema,
    saved: current && periodValues(current, contexts),
    onBlur: ['note'],
    readOnly,
  });
  const days = dateRangeProps(formRange(form, 'startDate', 'endDate'));
  return (
    // A new period only: an existing one is saved field by field.
    <form noValidate onSubmit={form.onSubmit((input) => saveContextPeriod.mutate({ id: null, input: { ...input, note: input.note || null } }, formCallbacks(form, 'Période planifiée.', onDone)))}>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="sm">
          {period && !readOnly && <SaveStatus saving={saving} />}
          <Select label="Contexte" required allowDeselect={false} {...itemSelectProps(contexts, form.values.contextId, undefined, period?.contextId)} {...form.getInputProps('contextId')} />
          <SimpleGrid cols={2} spacing="sm">
            <DatePickerInput label="Du" required {...days.start} />
            <DatePickerInput label="Au" required {...days.end} />
          </SimpleGrid>
          <MarkdownEditor label="Description" {...fieldProps('note')} value={form.values.note ?? ''} suggestions={NO_SUGGESTIONS} minRows={2} />
          {!period && <FormActions onCancel={onDone} submitLabel="Planifier" loading={saveContextPeriod.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}

/**
 * Contexts of spending (not in a tree; a line without context is everyday spending) and the periods they are
 * planned for: the lines of the entries dated in a period get its context proposed. The periods of an archived context
 * are hidden (and read only) unless the archived ones are shown.
 * @returns {JSX.Element} Sections.
 */
function Contexts() {
  const { data: settings } = useTreasurySettings();
  const { saveContext, deleteContext, deleteContextPeriod } = useTreasuryTeamMutations();
  const contexts = settings?.treasuryContexts ?? [];
  const contextById = mapById(contexts);
  const archivedPeriod = (period: TreasuryContextPeriod) => Boolean(contextById.get(period.contextId)?.archived);
  const { shown: periods, toggle: periodsToggle } = useArchivedToggle(settings?.treasuryContextPeriods ?? [], archivedPeriod);
  /**
   * Opens the form of a new or changed period.
   * @param {TreasuryContextPeriod} [period] Period changed. Optional.
   * @returns {void}
   */
  const openPeriod = (period?: TreasuryContextPeriod) =>
    openFormPanel(period ? 'Modifier la période' : 'Planifier un contexte', (close) => <PeriodForm period={period} contexts={contexts} onDone={close} />);

  return (
    <>
      <SettingsList
        kind="TREASURY_CONTEXT"
        title="Contextes"
        description={`Une même dépense ne compte pas pareil en vacances ou au quotidien. Une ligne sans contexte est du « ${EVERYDAY_CONTEXT} ».`}
        noun="le contexte"
        items={contexts}
        schema={treasuryContextSchema}
        create={async (values) => createdId(await saveContext.mutateAsync({ id: null, input: { label: values.label, color: values.color } }))}
        update={(id, values) => saveContext.mutateAsync({ id, input: { label: values.label, color: values.color } })}
        remove={(id) => deleteContext.mutateAsync(id)}
        deleteMessage={(item) => (
          <>
            « {item.label} » sera supprimé définitivement avec ses périodes planifiées. Les lignes qui l’avaient deviendront du « {EVERYDAY_CONTEXT} ».
          </>
        )}
      />

      <SettingsSection
        title="Contextes planifiés"
        actions={
          <>
            <ShowArchivedSwitch {...periodsToggle} label="Afficher les archivées" />
            <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} disabled={!unarchived(contexts).length} onClick={() => openPeriod()}>
              Nouvelle période
            </ActionButton>
          </>
        }
        description="Les lignes des mouvements datés dans une période prennent son contexte (modifiable). Changer une période ne modifie pas les lignes déjà enregistrées."
      >
        {periods.length === 0 ? (
          <EmptyState compact icon={<CalendarBlankIcon aria-hidden />} message={contexts.length ? 'Aucune période planifiée.' : 'Créez d’abord un contexte.'} />
        ) : (
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {periods.map((period) => {
                const item = contextById.get(period.contextId);
                return (
                  <Table.Tr key={period.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {item && <ItemAvatar name={item.label} iconUrl={item.iconUrl} color={item.color} />}
                        <Text size="sm">{item?.label}</Text>
                        {item?.archived && <ArchivedBadge size="xs" />}
                      </Group>
                      {period.note && (
                        <Text size="xs" c="dimmed">
                          {period.note}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {fmt.day(period.startDate)} → {fmt.day(period.endDate)}
                      </Text>
                    </Table.Td>
                    <Table.Td w={1}>
                      {/* A period is part of its context: read only while it is archived. */}
                      {!item?.archived && (
                        <InlineActions
                          name={`${item?.label ?? ''} du ${fmt.day(period.startDate)}`}
                          items={[
                            { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openPeriod(period) },
                            {
                              label: 'Supprimer',
                              icon: <TrashIcon aria-hidden />,
                              danger: true,
                              onClick: () =>
                                confirmDestructive({
                                  title: 'Supprimer la période',
                                  risks: `La période « ${item?.label ?? ''} » du ${fmt.day(period.startDate)} au ${fmt.day(period.endDate)} sera supprimée. Les lignes déjà enregistrées gardent leur contexte.`,
                                  run: () => deleteContextPeriod.mutateAsync(period.id),
                                  done: 'Période supprimée.',
                                }),
                            },
                          ]}
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </SettingsSection>
    </>
  );
}

/**
 * Contexts and their planned periods, one under the other (they are in the settings sidebar; the team or household
 * is in the settings, with the contributors).
 * @returns {JSX.Element} Sections.
 */
export function TeamPanel() {
  return (
    <Stack gap="md">
      <Contexts />
    </Stack>
  );
}

/** Values of a relation. */
type RelationValues = { name: string; note: string | null; contributorId: string | null };

/**
 * Values of a relation (a new one: the name typed).
 * @param {TreasuryRelation | undefined} relation Relation, as the cache holds it.
 * @param {string} name Name of a new one.
 * @returns {RelationValues} Values.
 */
const relationValues = (relation: TreasuryRelation | undefined, name: string): RelationValues => ({
  name: relation?.name ?? name,
  note: relation?.note ?? null,
  contributorId: relation?.contributorId ?? null,
});

/**
 * Input of a relation from its values: blanks are none.
 * @param {RelationValues} input Values.
 * @returns {RelationValues} Input.
 */
const relationInput = (input: RelationValues): RelationValues => ({ name: input.name, note: input.note || null, contributorId: input.contributorId ?? null });

/**
 * Relation form: name and note. A new relation is a form with « Ajouter »; an existing one, its panel, saves each field
 * as soon as it changes (texts on leaving them, decision D22, `useFieldSave`), the one of the cache followed; archived,
 * it is read only.
 * @param {{ relation?: TreasuryRelation, name?: string, onDone: (createdId?: string) => void }} props Component props (the name typed in a select, for a new one); the form closes with the id of the relation created.
 * @returns {JSX.Element} Form.
 */
export function RelationForm({ relation, name = '', onDone }: { relation?: TreasuryRelation; name?: string; onDone: (createdId?: string) => void }) {
  const { saveRelation } = useTreasuryTeamMutations();
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const words = relationWords(useActiveWorkspace().perso);
  const base = useAppForm<RelationValues>({ initialValues: relationValues(relation, name), schema: treasuryRelationSchema });
  const current = relation && (settings?.treasuryRelations.find((item) => item.id === relation.id) ?? relation);
  const readOnly = Boolean(current?.archived);
  const { form, saving, commit } = useFieldSave(base, {
    save: relation ? (_changes, input) => saveRelation.mutateAsync({ id: relation.id, input: relationInput(input) }) : null,
    schema: treasuryRelationSchema,
    saved: current && relationValues(current, ''),
    onBlur: ['name', 'note'],
    readOnly,
  });
  // Contributors that are no member nor another relation already.
  const members = new Set((settings?.treasuryMembers ?? []).map((member) => member.id));
  const taken = new Set((settings?.treasuryRelations ?? []).filter((item) => item.id !== relation?.id).map((item) => item.contributorId));
  // Archived contributors are not offered (the current one stays).
  const contributors = unarchived(context?.contributors ?? [], form.values.contributorId).filter((contributor) => !members.has(contributor.id) && !taken.has(contributor.id));
  return (
    // A new relation only: an existing one is saved field by field (Enter saves the text typed).
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveRelation.mutate(
          { id: null, input: relationInput(input) },
          formCallbacks(form, `${words.noun} ${agreed('ajouté', words.feminine)}.`, (id: string) => onDone(id)),
        ),
      )}
    >
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="sm">
          {relation && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Nom" required data-autofocus={relation ? undefined : true} placeholder="Paul, Mamie, Association du quartier…" {...form.getInputProps('name')} />
          <Select
            label="Contributeur"
            description="Si cette personne intervient aussi sur des projets ou des tâches."
            placeholder="Aucun"
            clearable
            searchable
            data={contributors.map((item) => ({ value: item.id, label: item.name }))}
            {...form.getInputProps('contributorId')}
            onChange={(contributorId) => {
              const chosen = contributors.find((contributor) => contributor.id === contributorId);
              // Without a name yet, it takes the contributor's (saved with it).
              base.setValues({ contributorId, ...(chosen && !form.values.name.trim() ? { name: chosen.name } : {}) });
              commit(['contributorId', 'name']);
            }}
          />
          <Textarea label="Description" placeholder="Facultative" autosize minRows={2} {...form.getInputProps('note')} value={form.values.note ?? ''} />
          {!relation && <FormActions onCancel={() => onDone()} submitLabel="Ajouter" loading={saveRelation.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}

/**
 * Relations: people out of the team or household (friends, family, partners…) lines and budgets can be for, to
 * follow loans, gifts… One may also be a contributor (not a member); organizations stay counterparties. An archived
 * relation is hidden (from the list unless asked, and from the pickers) and read only.
 * @returns {JSX.Element} Section.
 */
export function TeamRelations() {
  const { data: settings } = useTreasurySettings();
  const { deleteRelation } = useTreasuryTeamMutations();
  const setArchived = useSetArchived('TREASURY_RELATION', [treasuryKey]);
  const words = relationWords(useActiveWorkspace().perso);
  /**
   * Opens the form of a new or changed relation.
   * @param {TreasuryRelation} [relation] Relation changed. Optional.
   * @returns {void}
   */
  const openRelation = (relation?: TreasuryRelation) => openFormPanel(relation ? `Modifier ${words.the}` : words.new, (close) => <RelationForm relation={relation} onDone={close} />);
  const { context } = useTaskContext();
  const contributorName = new Map((context?.contributors ?? []).map((contributor) => [contributor.id, contributor.name]));
  const { shown: relations, toggle: relationsToggle } = useArchivedToggle(settings?.treasuryRelations ?? []);
  const uses = (relation: TreasuryRelation) =>
    [relation.lineCount ? countOf(relation.lineCount, 'ligne') : '', relation.budgetCount ? countOf(relation.budgetCount, 'budget') : ''].filter(Boolean).join(', ');

  return (
    <SettingsSection
      title={words.many}
      actions={
        <>
          <ShowArchivedSwitch {...relationsToggle} label={`Afficher les ${agreed('archivé', words.feminine, 2)}`} />
          <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} onClick={() => openRelation()}>
            {words.new}
          </ActionButton>
        </>
      }
      description="Personnes hors de l’équipe ou du foyer (amis, famille, partenaires…) pour qui une ligne ou un budget peut être : prêt, cadeau… Les organismes restent des tiers."
    >
      {relations.length === 0 ? (
        <EmptyState compact message={words.none} />
      ) : (
        <Table verticalSpacing={4}>
          <Table.Tbody>
            {relations.map((relation) => (
              <Table.Tr key={relation.id}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm">{relation.name}</Text>
                    {relation.archived && <ArchivedBadge feminine={words.feminine} size="xs" />}
                    {relation.contributorId && (
                      <Badge size="xs" variant="light" color="gray">
                        Contributeur
                        {contributorName.get(relation.contributorId) && contributorName.get(relation.contributorId) !== relation.name ? ` · ${contributorName.get(relation.contributorId)}` : ''}
                      </Badge>
                    )}
                  </Group>
                  {relation.note && <MarkdownView targets={NO_TARGETS}>{relation.note}</MarkdownView>}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {uses(relation)}
                  </Text>
                </Table.Td>
                <Table.Td w={1}>
                  <InlineActions
                    name={relation.name}
                    items={[
                      !relation.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRelation(relation) },
                      archiveEntry({ archived: relation.archived, type: words.noun, label: relation.name, feminine: words.feminine }, setArchived, relation.id),
                      {
                        label: 'Supprimer',
                        icon: <TrashIcon aria-hidden />,
                        danger: true,
                        onClick: () =>
                          confirmDestructive({
                            title: `Supprimer ${words.the}`,
                            risks: `${fmt.capitalize(words.the)} « ${relation.name} » sera ${agreed('supprimé', words.feminine)} définitivement.${relation.budgetCount ? ` Ses budgets aussi.` : ''}${relation.lineCount ? ` Ses lignes vous seront attribuées.` : ''}`,
                            run: () => deleteRelation.mutateAsync(relation.id),
                            done: `${words.noun} ${agreed('supprimé', words.feminine)}.`,
                          }),
                      },
                    ]}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </SettingsSection>
  );
}
