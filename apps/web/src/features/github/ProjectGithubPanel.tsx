import { Alert, Anchor, Badge, Button, Divider, Group, Paper, Select, SimpleGrid, Skeleton, Stack, Switch, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { ArrowsClockwiseIcon, GithubLogoIcon, LinkBreakIcon, PencilSimpleIcon, WarningIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useGithubBoard, useGithubLink, useGithubLogin, useGithubMutations, type GithubBoard, type GithubLink, type LinkValues } from './api';

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

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
 * Name compared without case or accents.
 * @param {string} name Name.
 * @returns {string} Folded name.
 */
const fold = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Option of the board guessed for an Ordo label (same name, or a usual English name).
 * @param {string} name Ordo label.
 * @param {{ id: string, name: string }[]} options Options.
 * @returns {string | undefined} Option id.
 */
function guessOption(name: string, options: { id: string; name: string }[]): string | undefined {
  const own = fold(name);
  return options.find((option) => fold(option.name) === own || (SYNONYMS[own] ?? []).includes(fold(option.name)))?.id;
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
  const guessAll = (choices: { id: string; name: string }[], labels: { id: string; name: string }[]) =>
    Object.fromEntries(labels.map((label) => [label.id, guessOption(label.name, choices)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const options = (fieldId: string | null, labels: { id: string; name: string }[]) => guessAll(board.fields.find((item) => item.id === fieldId)?.options ?? [], labels);
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
  context: TaskContext;
  onDone: () => void;
}

/**
 * Settings of a link: fields of the board for each Ordo field, options for each status and priority, where
 * new tasks go, tasks already there, sync on or off.
 * @param {LinkFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function LinkForm({ projectId, board, initial, context, onDone }: LinkFormProps) {
  const { saveLink } = useGithubMutations();
  const [values, setValues] = useState<LinkValues>(initial);
  const change = (changes: Partial<LinkValues>) => setValues((current) => ({ ...current, ...changes }));
  // Issue fields of the organization: values on the issues only (drafts have none).
  const fieldsOf = (type: string) =>
    board.fields.filter((field) => field.dataType === type).map((field) => ({ value: field.id, label: field.issueField ? `${field.name} (champ d’issue)` : field.name }));
  const optionsOf = (fieldId: string | null) => board.fields.find((field) => field.id === fieldId)?.options.map((option) => ({ value: option.id, label: option.name })) ?? [];
  const typeChoices =
    values.typeSource === 'ISSUE_TYPE' ? board.issueTypes.map((type) => ({ value: type.id, label: type.name })) : values.typeSource === 'FIELD' ? optionsOf(values.typeFieldId) : [];
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
  const mappingTable = (labels: { id: string; name: string }[], choices: { value: string; label: string }[], key: 'statusOptions' | 'priorityOptions' | 'typeOptions') => (
      <Table verticalSpacing={4} withRowBorders={false}>
        <Table.Tbody>
          {labels.map((label) => (
            <Table.Tr key={label.id}>
              <Table.Td w="40%">
                <Text size="sm">{label.name}</Text>
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  placeholder="Non synchronisé"
                  clearable
                  aria-label={`Option GitHub de ${label.name}`}
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
      <Text size="sm">
        Tableau{' '}
        <Anchor href={board.url} target="_blank" rel="noopener" size="sm" fw={600}>
          {board.title}
        </Anchor>
        . Toujours synchronisés : titre, description et commentaires ; pour les issues, l’ouverture / fermeture, le jalon, le parent (sous-issues), les
        dépendances (« bloquée par »), les relations (« relative à ») et le numéro (celui de l’issue). Choisissez où vont les autres champs.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Select label="Statut" placeholder="Non synchronisé" clearable data={fieldsOf('SINGLE_SELECT')} value={values.statusFieldId} onChange={(statusFieldId) => change({ statusFieldId, statusOptions: {} })} />
        <Select label="Priorité" placeholder="Non synchronisée" clearable data={fieldsOf('SINGLE_SELECT')} value={values.priorityFieldId} onChange={(priorityFieldId) => change({ priorityFieldId, priorityOptions: {} })} />
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
        <Select label="Sprint (itérations)" placeholder="Non synchronisé" clearable data={fieldsOf('ITERATION')} value={values.iterationFieldId} onChange={(iterationFieldId) => change({ iterationFieldId })} />
        <Select label="Début" placeholder="Non synchronisé" clearable data={fieldsOf('DATE')} value={values.startFieldId} onChange={(startFieldId) => change({ startFieldId })} />
        <Select label="Fin" placeholder="Non synchronisée" clearable data={fieldsOf('DATE')} value={values.endFieldId} onChange={(endFieldId) => change({ endFieldId })} />
        <Select label="Date max" placeholder="Non synchronisée" clearable data={fieldsOf('DATE')} value={values.deadlineFieldId} onChange={(deadlineFieldId) => change({ deadlineFieldId })} />
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
          Les itérations du tableau deviennent des sprints du projet (créés et mis à jour à chaque synchronisation).
        </Text>
      )}
      {(values.statusFieldId || values.priorityFieldId || values.typeSource) && (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {values.statusFieldId && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Statuts
              </Text>
              {mappingTable(context.statuses, optionsOf(values.statusFieldId), 'statusOptions')}
            </Stack>
          )}
          {values.priorityFieldId && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Priorités
              </Text>
              {mappingTable(context.priorities, optionsOf(values.priorityFieldId), 'priorityOptions')}
            </Stack>
          )}
          {values.typeSource && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Types
              </Text>
              {mappingTable(context.types, typeChoices, 'typeOptions')}
              {values.typeSource === 'ISSUE_TYPE' && (
                <Text size="xs" c="dimmed">
                  Les brouillons d’issue n’ont pas de type.
                </Text>
              )}
            </Stack>
          )}
        </SimpleGrid>
      )}
      <Divider />
      <TextInput
        label="Dépôt des nouvelles tâches"
        description="Les tâches créées dans Ordo deviennent des issues de ce dépôt (compte/dépôt) ; vide : des brouillons du tableau."
        placeholder="compte/dépôt"
        value={values.repositoryName ?? ''}
        onChange={(event) => change({ repositoryName: event.currentTarget.value || null })}
      />
      <Switch
        label="Envoyer aussi les tâches qui existaient avant la liaison"
        checked={values.pushExisting}
        onChange={(event) => change({ pushExisting: event.currentTarget.checked })}
      />
      <Switch
        label="Synchronisation automatique (toutes les 10 minutes)"
        checked={values.enabled}
        onChange={(event) => change({ enabled: event.currentTarget.checked })}
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={saveLink.isPending}
          onClick={() =>
            saveLink.mutate(
              { projectId, input: values },
              {
                onSuccess: () => {
                  notifySuccess('Liaison enregistrée. Lancez une synchronisation pour échanger les tâches.');
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Settings of an existing link, once its board is loaded again.
 * @param {{ link: GithubLink, context: TaskContext, onDone: () => void }} props Link, task context, close callback.
 * @returns {JSX.Element} Form.
 */
function EditLink({ link, context, onDone }: { link: GithubLink; context: TaskContext; onDone: () => void }) {
  const board = useGithubBoard(link.url);
  if (board.error) return <Alert color="red">{board.error.message}</Alert>;
  if (!board.data) return <Skeleton height={300} />;
  return (
    <LinkForm
      projectId={link.projectId}
      board={board.data}
      context={context}
      onDone={onDone}
      initial={{
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
      }}
    />
  );
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

  if (loginPending || isPending || !context) return <Skeleton height={240} />;
  if (!login) {
    return (
      <Alert color="yellow" icon={<WarningIcon aria-hidden />}>
        GitHub n’est pas connecté : ajoutez un jeton dans{' '}
        <Anchor component={Link} to="/settings?tab=github" size="sm">
          Paramètres › GitHub
        </Anchor>
        .
      </Alert>
    );
  }

  /**
   * Asks for confirmation before unlinking.
   * @returns {void}
   */
  const confirmUnlink = () => {
    const modalId = 'github-unlink';
    modals.open({
      modalId,
      title: 'Délier le tableau GitHub',
      children: (
        <Stack gap="md">
          <Text size="sm">
            La synchronisation s’arrête : les tâches et sprints restent dans Ordo, les items restent sur GitHub, mais ils ne sont plus liés. Une nouvelle liaison les
            dupliquerait.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              unlink.mutate(projectId, { onSuccess: () => notifySuccess('Tableau GitHub délié.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  if (!link) {
    return (
      <Stack gap="md">
        <Paper withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="xs">
              <GithubLogoIcon size={20} aria-hidden />
              <Title order={2} size="h4">
                Lier un tableau GitHub Projects
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              Les tâches du projet et de ses sous-projets et les items du tableau (issues et brouillons) sont synchronisés dans les deux sens.
            </Text>
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
                <Button type="submit" loading={board.isFetching} disabled={!url.trim()}>
                  Charger
                </Button>
              </Group>
            </form>
          </Stack>
        </Paper>
        {board.data && (
          <Paper withBorder radius="md" p="lg">
            <LinkForm projectId={projectId} board={board.data} initial={guessSettings(board.data, context)} context={context} onDone={() => setRequested(null)} />
          </Paper>
        )}
      </Stack>
    );
  }

  const summary = link.lastSyncSummary as Record<string, number> | null;
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
                <Anchor href={link.url} target="_blank" rel="noopener" fw={600}>
                  {link.title}
                </Anchor>
                <Badge variant="light" color={link.enabled ? 'green' : 'gray'}>
                  {link.enabled ? 'Synchronisation automatique' : 'Synchronisation manuelle'}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {link.linkedTaskCount} tâche{link.linkedTaskCount > 1 ? 's' : ''} liée{link.linkedTaskCount > 1 ? 's' : ''}
                {link.repositoryName ? ` · nouvelles tâches en issues de ${link.repositoryName}` : ' · nouvelles tâches en brouillons'}
                {link.lastSyncAt && ` · dernière synchronisation le ${dateTimeFormat.format(new Date(link.lastSyncAt))}`}
              </Text>
            </Stack>
            <Group gap="xs">
              <Button
                leftSection={<ArrowsClockwiseIcon aria-hidden />}
                loading={sync.isPending}
                onClick={() =>
                  sync.mutate(projectId, {
                    onSuccess: (result) =>
                      notifySuccess(
                        `Synchronisé : ${result.pulledNew} tâche(s) et ${result.pushedNew} item(s) créés, ${result.pulled} tâche(s) et ${result.pushed} item(s) mis à jour, ${result.renumbered} tâche(s) renumérotée(s), ${result.comments} commentaire(s) échangé(s).`,
                      ),
                    onError: (error) => notifyError(error.message),
                  })
                }
              >
                Synchroniser
              </Button>
              <Button variant="default" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => setEditing((value) => !value)}>
                Réglages
              </Button>
              <Button variant="subtle" color="red" leftSection={<LinkBreakIcon aria-hidden />} onClick={confirmUnlink}>
                Délier
              </Button>
            </Group>
          </Group>
          {link.lastSyncError && (
            <Alert color="red" icon={<WarningIcon aria-hidden />} title="Dernière synchronisation en échec">
              {link.lastSyncError}
            </Alert>
          )}
          {summary && !link.lastSyncError && (
            <Text size="xs" c="dimmed">
              Dernier échange : {summary.pulledNew} tâche(s) créée(s) depuis GitHub, {summary.pushedNew} item(s) créé(s) sur GitHub, {summary.pulled} tâche(s) et{' '}
              {summary.pushed} item(s) mis à jour, {summary.unlinked} tâche(s) déliée(s), {summary.sprints} sprint(s) créé(s) ou mis à jour, {summary.renumbered ?? 0} tâche(s) renumérotée(s), {summary.comments ?? 0}{' '}
              commentaire(s) échangé(s).
            </Text>
          )}
        </Stack>
      </Paper>
      {editing && (
        <Paper withBorder radius="md" p="lg">
          <EditLink link={link} context={context} onDone={() => setEditing(false)} />
        </Paper>
      )}
      <Text size="xs" c="dimmed">
        Un champ modifié d’un seul côté passe de l’autre ; modifié des deux côtés, la modification la plus récente gagne. Une tâche supprimée dans Ordo est retirée du
        tableau (une issue reste dans son dépôt) ; un item retiré du tableau laisse sa tâche dans Ordo, déliée.
      </Text>
    </Stack>
  );
}
