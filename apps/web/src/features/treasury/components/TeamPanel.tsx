import { IconAction } from '../../../components/actions/IconAction';
import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { ColorField } from '../../../components/inputs/ColorField';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PersonRow } from '../../../components/people/people-rows';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { SettingsList } from '../../../components/settings/SettingsList';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';

import { Badge, Fieldset, Group, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { mapById, EVERYDAY_CONTEXT, personDetailsSchema, treasuryContextSchema, treasuryRelationSchema, agreed } from '@ordo/shared';
import { CalendarStarIcon, EyeIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserMinusIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { archiveEntry, unarchived, useArchivedToggle } from '../../../lib/archive';
import { useState } from 'react';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { toastCallbacks } from '../../../lib/notify';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useColorSwatches } from '../../../lib/use-color-swatches';
import { useActiveWorkspace } from '../../workspaces/api';
import { treasuryKey, useTreasurySettings, useTreasuryTeamMutations, type TreasuryRelation } from '../api';
import * as fmt from '../../../lib/format';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { useScheduleTypes, useSlotSourceArchiving } from '../../calendar/api';
import { useScheduleTypeItems } from '../../calendar/hooks/use-settings-items';
import { openSchedulesManager } from '../../calendar/lib/open-schedules';
import { inWorkspace } from '../../calendar/lib/layer-label';
import { personOptionRenderer } from '../../../components/people/person-option';
import { relationWords } from '../../../components/people/people-options';
import { openRelationForm } from '../lib/open-relation';
import { openMemberForm } from '../lib/open-member';
import type { Contributor } from '../../tasks/api';
import { PersonDetailsFields } from '../../../components/people/PersonDetailsFields';
import { NO_PERSON_DETAILS_VALUES, PERSON_DETAILS_ON_BLUR, personDetailsProps, personDetailsValues, type PersonDetailsValues } from '../../../components/people/person-details';

/**
 * Members of the team (professional workspace) or household (personal one): "Moi" always is one; a member is a
 * contributor (an existing one not linked to a relation nor a contact, or a new one created with their name), whose
 * details (birth date, birthday reminders, email addresses, phones) are edited in its form here (« Modifier »). A
 * member removed stays a contributor, without details. An archived member is hidden unless asked, and archived
 * contributors are not offered as new members.
 * @returns {JSX.Element} Section.
 */
export function TeamMembers() {
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const { perso } = useActiveWorkspace();
  const { addMember, removeMember } = useTreasuryTeamMutations();
  const [name, setName] = useState('');
  const setArchived = useSlotSourceArchiving('CONTRIBUTOR');
  // Names and avatars as the contributors have them now (renamed or removed in the list of contributors).
  const contributorById = mapById(context?.contributors ?? []);
  const members = (settings?.treasuryMembers ?? [])
    .filter((member) => !context || contributorById.has(member.id))
    .map((member) => ({
      ...member,
      archived: contributorById.get(member.id)?.archived ?? false,
      ...(contributorById.get(member.id) ? { name: contributorById.get(member.id)!.name, avatarUrl: contributorById.get(member.id)!.avatarUrl } : {}),
    }));
  const { shown: shownMembers, toggle: membersToggle } = useArchivedToggle(members);
  // A contributor linked to a relation or a contact is not a member too.
  const others = unarchived(context?.contributors ?? []).filter((contributor) => contributor.link === 'NONE');
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
                <InlineActions
                  name={member.name}
                  items={[
                    contributorById.get(member.id) && {
                      label: member.archived ? 'Voir' : 'Modifier',
                      icon: member.archived ? <EyeIcon aria-hidden /> : <PencilSimpleIcon aria-hidden />,
                      onClick: () => openMemberForm(contributorById.get(member.id)!),
                    },
                    ...(member.isMe
                      ? []
                      : [
                    archiveEntry({ archived: member.archived, type: 'Membre', label: member.name }, setArchived, member.id),
                      {
                        label: 'Retirer',
                        hint: `Retirer du ${team.toLowerCase()} (reste contributeur)`,
                        icon: <UserMinusIcon aria-hidden />,
                        onClick: () => removeMember.mutate(member.id, toastCallbacks(`${member.name} n’est plus membre.`)),
                      },
                        ]),
                  ]}
                />
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

/**
 * Contexts of spending (not in a tree; a line without context is everyday spending): the kinds of éphémérides of the
 * calendar « Sert de contexte au budget », the same settings list as in the calendar (label, color, image,
 * display, budget fields), their éphémérides their periods (« Périodes » opens them). Those shared by another workspace
 * are listed apart, read only (changed in that workspace).
 * @returns {JSX.Element} Sections.
 */
function Contexts() {
  const { data: settings } = useTreasurySettings();
  const { data: types } = useScheduleTypes();
  const kind = useScheduleTypeItems({ ephemeris: true, budgetContext: true });
  const { perso } = useActiveWorkspace();
  /**
   * Deletes a context: « Sert de contexte au budget » unchecked on its kind, as in the form of the kind (the kind and
   * its éphémérides stay; refused while lines or budgets have it).
   * @param {string} id Kind.
   * @returns {Promise<unknown>} Update.
   */
  const uncheckContext = (id: string) => {
    const type = (types ?? []).find((item) => item.id === id)!;
    return kind.update(id, { label: type.label, color: type.color, parentId: null, ...kind.extra!.initial(type), budgetContext: false, sharedContext: false });
  };
  const shared = (settings?.treasuryContexts ?? []).filter((context) => context.workspaceLabel);
  return (
    <>
      <SettingsList
        {...kind}
        title="Contextes"
        description={`Une même dépense ne compte pas pareil en vacances ou au quotidien. Une ligne sans contexte est du « ${EVERYDAY_CONTEXT} ». Chaque contexte est un type d’éphémérides de l’agenda : les lignes des mouvements datés pendant l’une de ses éphémérides prennent ce contexte (modifiable).`}
        noun="le contexte"
        items={(types ?? []).filter((type) => type.budgetContext)}
        headerActions={
          <ActionButton priority="secondary" icon={<CalendarStarIcon aria-hidden />} hint="Les éphémérides, périodes des contextes" onClick={() => openSchedulesManager(true, perso)}>
            Périodes
          </ActionButton>
        }
        remove={(id) => uncheckContext(id)}
        deleteMessage={(item) => (
          <>
            « {item.label} » ne sera plus un contexte du budget : son type d’éphémérides et ses éphémérides restent dans l’agenda, sans « Sert de contexte au budget » (à
            recocher dans les types d’éphémérides). Refusé tant que des lignes ou des budgets l’ont.
          </>
        )}
        reversibleDelete={(item) => `« ${item.label} » n’est plus un contexte.`}
      />
      {shared.length > 0 && (
        <SettingsSection title="Contextes partagés par d’autres espaces" description="Ils se modifient dans l’agenda de leur espace.">
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {shared.map((context) => (
                <Table.Tr key={context.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ItemAvatar name={context.label} iconUrl={context.iconUrl} color={context.color} />
                      <Text size="sm">{inWorkspace(context.label, context.workspaceLabel ?? undefined)}</Text>
                      {context.archived && <ArchivedBadge size="xs" />}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </SettingsSection>
      )}
    </>
  );
}

/**
 * Contexts (and their periods, the éphémérides of their kinds), one under the other (they are in the settings sidebar; the team or household
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

/**
 * Form of a member of the team or household (« Moi » included): its details (birth date, birthday reminders, email
 * addresses, phones), the only place they are edited (a contributor that is not a member has none of its own), each
 * saved as soon as it changes (texts on leaving them, `useFieldSave`), the member of the cache followed; archived, it
 * is read only. Its name, handle, avatar and projects are those of the contributor (its own form).
 * @param {{ member: Contributor }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MemberForm({ member }: { member: Contributor }) {
  const { updateMember } = useTreasuryTeamMutations();
  const { context } = useTaskContext();
  const current = context?.contributors.find((item) => item.id === member.id) ?? member;
  const readOnly = current.archived;
  const base = useAppForm<PersonDetailsValues>({ initialValues: personDetailsValues(member), schema: personDetailsSchema });
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: (changes) => updateMember.mutateAsync({ contributorId: member.id, input: changes }),
    schema: personDetailsSchema,
    saved: personDetailsValues(current),
    onBlur: PERSON_DETAILS_ON_BLUR,
    readOnly,
  });
  return (
    <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
      <Stack gap="sm">
        {!readOnly && <SaveStatus saving={saving} />}
        <PersonRow name={current.name} avatarUrl={current.avatarUrl} />
        <PersonDetailsFields {...personDetailsProps(form, fieldProps)} />
      </Stack>
    </Fieldset>
  );
}

/** Values of a relation: its fields and its details. */
type RelationValues = { name: string; note: string | null; contributorId: string | null } & PersonDetailsValues;

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
  ...(relation ? personDetailsValues(relation) : NO_PERSON_DETAILS_VALUES),
});

/**
 * Input of a relation from its values: blanks are none.
 * @param {RelationValues} input Values.
 * @returns {RelationValues} Input.
 */
const relationInput = (input: RelationValues): RelationValues => ({ ...input, note: input.note || null, contributorId: input.contributorId ?? null });

/**
 * Relation form: name, contributor, note, and its details (birth date, birthday reminders, email addresses, phones). A new relation is a form with « Ajouter »; an existing one, its panel, saves each field
 * as soon as it changes (texts on leaving them, `useFieldSave`), the one of the cache followed; archived,
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
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: relation ? (_changes, input) => saveRelation.mutateAsync({ id: relation.id, input: relationInput(input) }) : null,
    schema: treasuryRelationSchema,
    saved: current && relationValues(current, ''),
    onBlur: ['name', 'note', ...PERSON_DETAILS_ON_BLUR],
    readOnly,
  });
  // Contributors linked to nothing (no member, no contact, no other relation), and the current one; archived ones are
  // not offered (the current one stays).
  const contributors = unarchived(context?.contributors ?? [], form.values.contributorId).filter(
    (contributor) => contributor.link === 'NONE' || contributor.id === form.values.contributorId || (relation && contributor.relationId === relation.id),
  );
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
            description="Si cette personne intervient aussi sur des projets ou des tâches : le contributeur a alors ses coordonnées et son anniversaire."
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
          <PersonDetailsFields {...personDetailsProps(form, fieldProps)} />
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
  const setArchived = useSlotSourceArchiving('TREASURY_RELATION', [treasuryKey]);
  const { perso } = useActiveWorkspace();
  const words = relationWords(perso);
  /**
   * Opens the form of a new or changed relation.
   * @param {TreasuryRelation} [relation] Relation changed. Optional.
   * @returns {void}
   */
  const openRelation = (relation?: TreasuryRelation) => openRelationForm(relation, perso);
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
