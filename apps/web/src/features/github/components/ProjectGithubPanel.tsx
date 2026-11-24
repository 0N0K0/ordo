import { LabeledField } from '../../../components/inputs/LabeledField';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { countOf, nameKey, plural, sameName } from '../../../lib/text';

import { SettingsSection } from '../../../components/settings/SettingsSection';
import { FormSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Anchor, Badge, Divider, Group, Paper, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, ThemeIcon } from '@mantine/core';
import { ArrowsClockwiseIcon, GithubLogoIcon, LinkBreakIcon, PencilSimpleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toastCallbacks } from '../../../lib/notify';
import { formCallbacks, useAppForm, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { githubLinkFormSchema } from '@ordo/shared';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { useGithubBoard, useGithubLink, useGithubLogin, useGithubMutations, type GithubBoard, type GithubLink, type LinkValues } from '../api';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { GITHUB_SETTINGS_PATH } from '../../../app/pages';
import { syncSummaryText, type SyncSummary } from '../lib/sync-summary';

/** Usual English names of the GitHub board options, for the first guess. */
const SYNONYMS: Record<string, string[]> = {
  'a faire': ['todo', 'to do', 'backlog'],
  'en cours': ['in progress', 'doing'],
  'en revue': ['in review', 'review'],
  termine: ['done', 'closed'],
  annule: ['cancelled', 'canceled', "won't do"],
  urgente: ['p0', 'urgent', 'critical'],
  haute: ['p1', 'high'],
  moyenne: ['p2', 'medium'],
  basse: ['p3', 'low'],
};

/**
 * Option of the board guessed for an Ordo label (same name, or a usual English name).
 * @param {string} name Ordo label.
 * @param {{ id: string, name: string }[]} options Options.
 * @returns {string | undefined} Option id.
 */
function guessOption(name: string, options: { id: string; name: string }[]): string | undefined {
  const own = nameKey(name);
  return options.find((option) => sameName(option.name, name) || (SYNONYMS[own] ?? []).includes(nameKey(option.name)))?.id;
}

/**
 * First field of a type whose name matches.
 * @param {GithubBoard} board Board.
 * @param {string} type Data type.
 * @param {RegExp} [name] Name pattern. Optional.
 * @returns {string | null} Field id.
 */
const guessField = (board: GithubBoard, type: string, name?: RegExp) => board.fields.find((field) => field.dataType === type && (!name || name.test(field.name)))?.id ?? null;

/** Value of the type select meaning the issue types of the organization (the other values are field ids). */
const ISSUE_TYPES = '__issue_types';

/**
 * Settings guessed for a board: fields by name and type, options by name.
 * @param {GithubBoard} board Board.
 * @param {TaskContext} context Task context.
 * @returns {LinkValues} Settings.
 */
function guessSettings(board: GithubBoard, context: TaskContext): LinkValues {
  const statusFieldId = guessField(board, 'SINGLE_SELECT', /^status$|statut/i);
  const priorityFieldId = guessField(board, 'SINGLE_SELECT', /priorit/i);
  const typeFieldId = board.issueTypes.length ? null : guessField(board, 'SINGLE_SELECT', /^type$|type/i);
  const guessAll = (choices: { id: string; name: string }[], labels: { id: string; label: string }[]) =>
    Object.fromEntries(labels.map((label) => [label.id, guessOption(label.label, choices)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const options = (fieldId: string | null, labels: { id: string; label: string }[]) => guessAll(board.fields.find((item) => item.id === fieldId)?.options ?? [], labels);
  return {
    url: board.url,
    statusFieldId,
    priorityFieldId,
    iterationFieldId: guessField(board, 'ITERATION'),
    startFieldId: guessField(board, 'DATE', /start|d[ée]but/i),
    endFieldId: guessField(board, 'DATE', /end|target|due|fin|[ée]ch[ée]ance/i),
    effortFieldId: guessField(board, 'NUMBER', /estimat|effort|size|point|taille/i),
    deadlineFieldId: guessField(board, 'DATE', /deadline|max|limite/i),
    timeSpentFieldId: guessField(board, 'NUMBER', /spent|pass[ée]|tracked|temps/i),
    typeSource: board.issueTypes.length ? 'ISSUE_TYPE' : typeFieldId ? 'FIELD' : null,
    typeFieldId,
    statusOptions: options(statusFieldId, context.statuses),
    priorityOptions: options(priorityFieldId, context.priorities),
    typeOptions: board.issueTypes.length ? guessAll(board.issueTypes, context.types) : options(typeFieldId, context.types),
    syncAssignees: true,
    syncLabels: true,
    repositoryName: null,
    pushExisting: false,
    enabled: true,
  };
}

interface LinkFormProps {
  projectId: string;
  board: GithubBoard;
  initial: LinkValues;
  /** Settings of the existing link as the cache holds them; none: a new link. */
  saved?: LinkValues;
  context: TaskContext;
  /** Called once a new link is saved, or its form cancelled. */
  onDone: () => void;
}

/**
 * Settings of a link: fields of the board for each Ordo field, options for each status and priority, where
 * new tasks go, tasks already there, sync on or off. A new link is saved by its button; an existing one field by
 * field (each choice at once, the repository on leaving it).
 * @param {LinkFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function LinkForm({ projectId, board, initial, saved, context, onDone }: LinkFormProps) {
  const { saveLink } = useGithubMutations();
  const base = useAppForm<LinkValues>({ initialValues: initial, schema: githubLinkFormSchema });
  const { form, saving } = useFieldSave(base, {
    save: saved ? (_changes, input) => saveLink.mutateAsync({ projectId, input }) : null,
    schema: githubLinkFormSchema,
    saved,
    onBlur: ['repositoryName'],
  });
  const values = form.values;
  const change = (changes: Partial<LinkValues>) => form.setValues(changes);
  // Issue fields of the organization: values on the issues only (drafts have none).
  const fieldsOf = (type: string) =>
    board.fields.filter((field) => field.dataType === type).map((field) => ({ value: field.id, label: field.issueField ? `${field.name} (champ d’issue)` : field.name }));
  const optionsOf = (fieldId: string | null) => board.fields.find((field) => field.id === fieldId)?.options.map((option) => ({ value: option.id, label: option.name })) ?? [];
  const typeChoices = values.typeSource === 'ISSUE_TYPE' ? board.issueTypes.map((type) => ({ value: type.id, label: type.name })) : values.typeSource === 'FIELD' ? optionsOf(values.typeFieldId) : [];
  const typeSelect = [
    ...(board.issueTypes.length ? [{ group: 'Issues', items: [{ value: ISSUE_TYPES, label: 'Types d’issue de l’organisation' }] }] : []),
    { group: 'Champs du tableau', items: fieldsOf('SINGLE_SELECT') },
  ];

  /**
   * Correspondence table of Ordo labels and choices of GitHub (options of a field, or issue types).
   * @param {{ id: string, name: string }[]} labels Ordo labels.
   * @param {{ value: string, label: string }[]} choices GitHub choices.
   * @param {'statusOptions' | 'priorityOptions' | 'typeOptions'} key Mapping.
   * @returns {JSX.Element} Table.
   */
  const mappingTable = (labels: { id: string; label: string }[], choices: { value: string; label: string }[], key: 'statusOptions' | 'priorityOptions' | 'typeOptions') => (
    <Table verticalSpacing={4} withRowBorders={false}>
      <Table.Tbody>
        {labels.map((label) => (
          <Table.Tr key={label.id}>
            <Table.Td w="40%">
              <Text size="sm">{label.label}</Text>
            </Table.Td>
            <Table.Td>
              <Select
                size="xs"
                placeholder="Non synchronisé"
                clearable
                aria-label={`Option GitHub de « ${label.label} »`}
                data={choices}
                value={values[key][label.id] ?? null}
                onChange={(optionId) => {
                  const next = { ...values[key] };
                  if (optionId) next[label.id] = optionId;
                  else delete next[label.id];
                  change({ [key]: next });
                }}
              />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );

  return (
    <Stack gap="md">
      {saved && <SaveStatus saving={saving} />}
      <Text size="sm">
        Tableau{' '}
        <Anchor href={board.url} {...EXTERNAL_LINK} size="sm" fw={600}>
          {board.title}
        </Anchor>
        . Toujours synchronisés : titre, description et commentaires ; pour les issues, l’ouverture / fermeture, le jalon, le parent (sous-issues), les dépendances (« bloquée par »), les relations («
        relative à ») et le numéro (celui de l’issue). Choisissez où vont les autres champs.
      </Text>
      {/* By the width of the settings sidebar, not the window's. */}
      <SimpleGrid type="container" cols={{ base: 1, '480px': 2, '760px': 3 }} spacing="sm">
        <Select
          label="Statut"
          placeholder="Non synchronisé"
          clearable
          data={fieldsOf('SINGLE_SELECT')}
          value={values.statusFieldId}
          onChange={(statusFieldId) => change({ statusFieldId, statusOptions: {} })}
        />
        <Select
          label="Priorité"
          placeholder="Non synchronisée"
          clearable
          data={fieldsOf('SINGLE_SELECT')}
          value={values.priorityFieldId}
          onChange={(priorityFieldId) => change({ priorityFieldId, priorityOptions: {} })}
        />
        <Select
          label="Type"
          placeholder="Non synchronisé"
          clearable
          data={typeSelect}
          value={values.typeSource === 'ISSUE_TYPE' ? ISSUE_TYPES : values.typeFieldId}
          onChange={(value) =>
            change(value === ISSUE_TYPES ? { typeSource: 'ISSUE_TYPE', typeFieldId: null, typeOptions: {} } : { typeSource: value ? 'FIELD' : null, typeFieldId: value, typeOptions: {} })
          }
        />
        <Select
          label="Sprint (itérations)"
          placeholder="Non synchronisé"
          clearable
          data={fieldsOf('ITERATION')}
          value={values.iterationFieldId}
          onChange={(iterationFieldId) => change({ iterationFieldId })}
        />
        <Select label="Début" placeholder="Non synchronisé" clearable data={fieldsOf('DATE')} value={values.startFieldId} onChange={(startFieldId) => change({ startFieldId })} />
        <Select label="Fin" placeholder="Non synchronisée" clearable data={fieldsOf('DATE')} value={values.endFieldId} onChange={(endFieldId) => change({ endFieldId })} />
        <Select label="Échéance" placeholder="Non synchronisée" clearable data={fieldsOf('DATE')} value={values.deadlineFieldId} onChange={(deadlineFieldId) => change({ deadlineFieldId })} />
        <Select label="Effort" placeholder="Non synchronisé" clearable data={fieldsOf('NUMBER')} value={values.effortFieldId} onChange={(effortFieldId) => change({ effortFieldId })} />
        <Select
          label="Temps passé"
          description="En heures, d’Ordo vers GitHub"
          placeholder="Non synchronisé"
          clearable
          data={fieldsOf('NUMBER')}
          value={values.timeSpentFieldId}
          onChange={(timeSpentFieldId) => change({ timeSpentFieldId })}
        />
      </SimpleGrid>
      <Group gap="xl">
        <Switch label="Assignés (assignees GitHub)" checked={values.syncAssignees} onChange={(event) => change({ syncAssignees: event.currentTarget.checked })} />
        <Switch label="Étiquettes (labels des issues)" checked={values.syncLabels} onChange={(event) => change({ syncLabels: event.currentTarget.checked })} />
      </Group>
      {values.iterationFieldId && (
        <Text size="xs" c="dimmed">
          Itérations et sprints se correspondent par leur nom : une itération sans sprint devient un sprint du projet ; un sprint sans itération est à créer dans les réglages du tableau GitHub (l’API
          ne sait pas donner ses dates à une itération). Ordo fait référence pour les noms et dates. Une tâche placée dans une itération sur GitHub est ajoutée à son sprint, sans perdre ses autres
          sprints.
        </Text>
      )}
      {(values.statusFieldId || values.priorityFieldId || values.typeSource) && (
        <SimpleGrid type="container" cols={{ base: 1, '760px': 3 }} spacing="lg">
          {values.statusFieldId && <LabeledField label="Statuts">{mappingTable(context.statuses, optionsOf(values.statusFieldId), 'statusOptions')}</LabeledField>}
          {values.priorityFieldId && <LabeledField label="Priorités">{mappingTable(context.priorities, optionsOf(values.priorityFieldId), 'priorityOptions')}</LabeledField>}
          {values.typeSource && (
            <LabeledField label="Types">
              {mappingTable(context.types, typeChoices, 'typeOptions')}
              {values.typeSource === 'ISSUE_TYPE' && (
                <Text size="xs" c="dimmed">
                  Les brouillons d’issue n’ont pas de type.
                </Text>
              )}
            </LabeledField>
          )}
        </SimpleGrid>
      )}
      <Divider />
      <TextInput
        label="Dépôt des nouvelles tâches"
        description="Les tâches créées dans Ordo deviennent des issues de ce dépôt (compte/dépôt) ; vide : des brouillons du tableau."
        placeholder="compte/dépôt"
        {...form.getInputProps('repositoryName')}
        value={values.repositoryName ?? ''}
        onChange={(event) => form.setFieldValue('repositoryName', event.currentTarget.value || null)}
      />
      <Switch label="Envoyer aussi les tâches qui existaient avant la liaison" checked={values.pushExisting} onChange={(event) => change({ pushExisting: event.currentTarget.checked })} />
      <Switch label="Synchronisation automatique (toutes les 10 minutes)" checked={values.enabled} onChange={(event) => change({ enabled: event.currentTarget.checked })} />
      {!saved && (
        <FormActions
          onCancel={onDone}
          submitLabel="Lier"
          loading={saveLink.isPending}
          onSubmit={() =>
            !form.validate().hasErrors &&
            saveLink.mutate({ projectId, input: form.getValues() }, formCallbacks(form, 'Liaison enregistrée. Lancez une synchronisation pour échanger les tâches.', onDone))
          }
        />
      )}
    </Stack>
  );
}

/**
 * Settings of a link as its form holds them.
 * @param {GithubLink} link Link.
 * @returns {LinkValues} Settings.
 */
const linkValues = (link: GithubLink): LinkValues => ({
  url: link.url,
  statusFieldId: link.statusFieldId ?? null,
  priorityFieldId: link.priorityFieldId ?? null,
  iterationFieldId: link.iterationFieldId ?? null,
  startFieldId: link.startFieldId ?? null,
  endFieldId: link.endFieldId ?? null,
  effortFieldId: link.effortFieldId ?? null,
  deadlineFieldId: link.deadlineFieldId ?? null,
  timeSpentFieldId: link.timeSpentFieldId ?? null,
  typeSource: link.typeSource === 'FIELD' || link.typeSource === 'ISSUE_TYPE' ? link.typeSource : null,
  typeFieldId: link.typeFieldId ?? null,
  statusOptions: (link.statusOptions as Record<string, string>) ?? {},
  priorityOptions: (link.priorityOptions as Record<string, string>) ?? {},
  typeOptions: (link.typeOptions as Record<string, string>) ?? {},
  syncAssignees: link.syncAssignees,
  syncLabels: link.syncLabels,
  repositoryName: link.repositoryName ?? null,
  pushExisting: link.pushExisting,
  enabled: link.enabled,
});

/**
 * Settings of an existing link, once its board is loaded again: saved field by field.
 * @param {{ link: GithubLink, context: TaskContext }} props Link (as the cache holds it), task context.
 * @returns {JSX.Element} Form.
 */
function EditLink({ link, context }: { link: GithubLink; context: TaskContext }) {
  const board = useGithubBoard(link.url);
  if (board.error) return <ErrorAlert>{board.error.message}</ErrorAlert>;
  if (!board.data) return <FormSkeleton fields={4} />;
  return <LinkForm projectId={link.projectId} board={board.data} context={context} onDone={() => undefined} initial={linkValues(link)} saved={linkValues(link)} />;
}

/**
 * GitHub tab of a project: link to a GitHub Projects board (URL, then fields), state of the sync, manual sync,
 * settings, unlink.
 * @param {{ projectId: string }} props Project.
 * @returns {JSX.Element} Panel.
 */
export function ProjectGithubPanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { data: login, isPending: loginPending } = useGithubLogin();
  const { data: link, isPending } = useGithubLink(projectId);
  const { sync, unlink } = useGithubMutations();
  const [url, setUrl] = useState('');
  const [requested, setRequested] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const board = useGithubBoard(requested);

  if (loginPending || isPending || !context) return <FormSkeleton fields={3} />;
  if (!login) {
    return (
      <NoticeAlert kind="info">
        GitHub n’est pas connecté : ajoutez un jeton dans{' '}
        <Anchor component={Link} to={GITHUB_SETTINGS_PATH} size="sm">
          Paramètres › GitHub
        </Anchor>
        .
      </NoticeAlert>
    );
  }

  /**
   * Asks for confirmation before unlinking.
   * @returns {void}
   */
  const confirmUnlink = () => {
    confirmDestructive({
      title: 'Délier le tableau GitHub',
      risks:
        'La synchronisation s’arrête et Ordo oublie quel item, quelle itération et quel commentaire du tableau correspond à chaque tâche, sprint et commentaire. Rien n’est supprimé : les tâches, sprints et commentaires restent dans Ordo, les items restent sur le tableau (les issues dans leur dépôt), sans plus changer ensemble. Lier ce tableau à nouveau ne les rapparie pas : chaque item non archivé du tableau deviendrait une nouvelle tâche à côté de l’ancienne et, avec « Envoyer aussi les tâches qui existaient avant la liaison », chaque tâche active un nouvel item à côté de l’ancien (une nouvelle issue dans le dépôt, ou un brouillon) ; seuls les sprints retrouvent leur itération par leur nom.',
      confirmLabel: 'Délier',
      confirmIcon: <LinkBreakIcon aria-hidden />,
      run: () => unlink.mutateAsync(projectId),
      done: 'Tableau GitHub délié.',
    });
  };

  if (!link) {
    return (
      <Stack gap="md">
        <SettingsSection
          title={
            <Group gap="xs" component="span">
              <GithubLogoIcon size={20} aria-hidden /> Lier un tableau GitHub Projects
            </Group>
          }
          description={<>Les tâches du projet et de ses sous-projets et les items du tableau (issues et brouillons) sont synchronisés dans les deux sens.</>}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setRequested(url.trim());
            }}
          >
            <Group align="flex-end" gap="sm">
              <TextInput
                label="Adresse du tableau"
                placeholder="https://github.com/users/compte/projects/1"
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                style={{ flex: 1 }}
                error={board.error?.message}
              />
              <ActionButton type="submit" icon={<MagnifyingGlassIcon aria-hidden />} loading={board.isFetching} disabled={!url.trim()}>
                Charger
              </ActionButton>
            </Group>
          </form>
        </SettingsSection>
        {board.data && (
          <Paper withBorder radius="md" p="lg">
            <LinkForm projectId={projectId} board={board.data} initial={guessSettings(board.data, context)} context={context} onDone={() => setRequested(null)} />
          </Paper>
        )}
      </Stack>
    );
  }

  const summary = link.lastSyncSummary as SyncSummary | null;
  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Group gap="xs">
                <ThemeIcon variant="light" color="dark" size="md" radius="xl">
                  <GithubLogoIcon aria-hidden />
                </ThemeIcon>
                <Anchor href={link.url} {...EXTERNAL_LINK} fw={600}>
                  {link.label}
                </Anchor>
                <Badge variant="light" color={link.enabled ? 'green' : 'gray'}>
                  {link.enabled ? 'Synchronisation automatique' : 'Synchronisation manuelle'}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {countOf(link.linkedTaskCount, 'tâche')} {plural(link.linkedTaskCount, 'liée')}
                {link.repositoryName ? ` · nouvelles tâches en issues de ${link.repositoryName}` : ' · nouvelles tâches en brouillons'}
                {link.lastSyncAt && ` · dernière synchronisation le ${fmt.dateTime(link.lastSyncAt)}`}
              </Text>
            </Stack>
            <Group gap="xs">
              <ActionButton
                icon={<ArrowsClockwiseIcon aria-hidden />}
                loading={sync.isPending}
                onClick={() =>
                  sync.mutate(
                    projectId,
                    toastCallbacks((result) => `Synchronisé : ${syncSummaryText(result)}.`),
                  )
                }
              >
                Synchroniser
              </ActionButton>
              <ActionButton priority="secondary" icon={<PencilSimpleIcon aria-hidden />} onClick={() => setEditing((value) => !value)}>
                Réglages
              </ActionButton>
              <ActionButton danger icon={<LinkBreakIcon aria-hidden />} onClick={confirmUnlink}>
                Délier
              </ActionButton>
            </Group>
          </Group>
          {link.lastSyncError && <ErrorAlert title="Dernière synchronisation en échec">{link.lastSyncError}</ErrorAlert>}
          {summary && !link.lastSyncError && (
            <Text size="xs" c="dimmed">
              Dernier échange : {syncSummaryText(summary)}.
            </Text>
          )}
        </Stack>
      </Paper>
      {editing && (
        <Paper withBorder radius="md" p="lg">
          <EditLink link={link} context={context} />
        </Paper>
      )}
      <Text size="xs" c="dimmed">
        Un champ modifié d’un seul côté passe de l’autre ; modifié des deux côtés, la modification la plus récente gagne. Une tâche supprimée dans Ordo est retirée du tableau (une issue reste dans son
        dépôt) ; archiver ou restaurer une tâche archive ou sort de l’archive son item, et inversement ; un item retiré du tableau laisse sa tâche dans Ordo, déliée et archivée, avec un commentaire.
      </Text>
    </Stack>
  );
}
