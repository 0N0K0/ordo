import { ActionIcon, Anchor, Button, Checkbox, Collapse, FileButton, Group, Modal, Paper, Popover, Select, Stack, TagsInput, Text, TextInput, Tooltip } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { ClockCountdownIcon, PaperclipIcon, PaperPlaneTiltIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RichEditor } from '../../components/rich-text/RichEditor';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailActions, useMailAccounts } from './api';
import { mailHtml, type ComposeOptions, type MailLocation, type SourceFiles } from './compose-options';
import { fileSize } from './mail-format';
import { MailBody } from './MailBody';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Delay after the last change before the draft is saved. */
const AUTOSAVE_MS = 4000;
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const scheduleFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Usual moments to send a mail later: this afternoon (in the morning), tomorrow morning, next Monday morning.
 * @returns {{ label: string, at: Date }[]} Moments to come.
 */
function schedulePresets(): { label: string; at: Date }[] {
  const now = new Date();
  const at = (days: number, hour: number) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0);
    return date;
  };
  const monday = (8 - now.getDay()) % 7 || 7;
  return [
    ...(now.getHours() < 13 ? [{ label: 'Cet après-midi', at: at(0, 14) }] : []),
    { label: 'Demain matin', at: at(1, 8) },
    { label: 'Lundi matin', at: at(monday, 8) },
  ];
}

/**
 * Recipient field: addresses as chips, separated by commas, semicolons or spaces.
 * @param {object} props Component props.
 * @param {string} props.label Label.
 * @param {string[]} props.value Addresses.
 * @param {(value: string[]) => void} props.onChange Change handler.
 * @param {boolean} [props.autoFocus] Focus on open. Optional.
 * @returns {JSX.Element} Field.
 */
function RecipientsInput({ label, value, onChange, autoFocus }: { label: string; value: string[]; onChange: (value: string[]) => void; autoFocus?: boolean }) {
  const invalid = value.filter((address) => !EMAIL.test(address));
  return (
    <TagsInput
      label={label}
      value={value}
      onChange={(next) => onChange([...new Set(next.map((address) => address.trim()).filter(Boolean))])}
      splitChars={[',', ';', ' ']}
      acceptValueOnBlur
      clearable
      data-autofocus={autoFocus || undefined}
      error={invalid.length ? `Adresse invalide : ${invalid.join(', ')}` : undefined}
    />
  );
}

type SaveState = { status: 'idle' } | { status: 'saving' } | { status: 'saved'; at: Date } | { status: 'error' };

/**
 * Mail writing form: sender account, recipients, subject, rich body, signature, files, and the quoted or
 * forwarded mail under it. The draft is saved in the drafts folder a few seconds after each change;
 * closing asks whether to keep it.
 * @param {{ options: ComposeOptions, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MailComposer({ options, onDone }: { options: ComposeOptions; onDone: () => void }) {
  const { data: accounts } = useMailAccounts();
  const { send, saveDraft, deleteDraft, schedule } = useMailActions();
  const [scheduling, setScheduling] = useState(false);
  const [sendAt, setSendAt] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(options.accountId ?? null);
  const [to, setTo] = useState(options.to ?? []);
  const [cc, setCc] = useState(options.cc ?? []);
  const [bcc, setBcc] = useState(options.bcc ?? []);
  const [showCopies, setShowCopies] = useState((options.cc?.length ?? 0) + (options.bcc?.length ?? 0) > 0);
  const [subject, setSubject] = useState(options.subject ?? '');
  const [body, setBody] = useState(options.body ?? '');
  const [withSignature, setWithSignature] = useState(options.withSignature ?? true);
  const [files, setFiles] = useState<File[]>(options.files ?? []);
  const [sourceFiles, setSourceFiles] = useState<SourceFiles | null>(options.sourceFiles ?? null);
  const [showQuote, setShowQuote] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(options.draft ? { status: 'saved', at: new Date() } : { status: 'idle' });

  // Saved version of the draft; saves run one after the other.
  const draft = useRef<MailLocation | null>(options.draft ?? null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  // The closing question is open (shown over this form's modal, which stays mounted).
  const closing = useRef(false);
  const [askingClose, setAskingClose] = useState(false);

  const account = accounts?.find((item) => item.id === accountId) ?? accounts?.[0];
  const signature = withSignature ? account?.signature : null;
  const recipients = [...to, ...cc, ...bcc];
  const invalid = recipients.some((address) => !EMAIL.test(address));
  const hasContent = recipients.length > 0 || subject.trim() !== '' || body.replace(/<[^>]*>/g, '').trim() !== '' || files.length > 0;
  // Content as saved in a draft (files by name and size, wherever they are kept).
  const snapshot = JSON.stringify({
    accountId,
    to,
    cc,
    bcc,
    subject,
    body,
    withSignature,
    files: [...(sourceFiles?.files ?? []).map((file) => `${file.filename}:${file.size}`), ...files.map((file) => `${file.name}:${file.size}`)].sort(),
  });
  // Content of the last saved version (or of the opened draft).
  const [savedSnapshot, setSavedSnapshot] = useState(() => (options.draft ? snapshot : null));
  const unsaved = hasContent && snapshot !== savedSnapshot;

  /**
   * Fields shared by sending and saving.
   * @returns {object} Mail fields.
   */
  const fields = () => ({
    to,
    cc,
    bcc,
    subject,
    html: mailHtml(body, signature, options.quote),
    attachments: files,
    attachmentsFrom: sourceFiles?.files.length
      ? { ...sourceFiles.from, indexes: sourceFiles.files.map((file) => file.index) }
      : null,
    inReplyTo: options.inReplyTo ?? null,
    references: options.references ?? [],
    projectId: options.projectId ?? null,
  });

  /**
   * Saves the draft (after the saves already running): the new version replaces the previous one, and
   * the files sent become files of the draft.
   * @returns {Promise<void>}
   */
  const save = useCallback(() => {
    if (!account) return Promise.resolve();
    const content = snapshot;
    const run = saving.current.then(async () => {
      const sentFiles = files;
      setSaveState({ status: 'saving' });
      try {
        const saved = await saveDraft.mutateAsync({ ...fields(), accountId: account.id, replace: draft.current });
        draft.current = { accountId: saved.accountId, folder: saved.folder, uid: saved.uid };
        setSourceFiles({
          from: draft.current,
          files: saved.attachments.filter((file) => !file.inline).map(({ index, filename, size }) => ({ index, filename, size })),
        });
        setFiles((current) => (sentFiles.length ? current.filter((file) => !sentFiles.includes(file)) : current));
        setSavedSnapshot(content);
        setSaveState({ status: 'saved', at: new Date() });
      } catch (error) {
        setSaveState({ status: 'error' });
        throw error;
      }
    });
    saving.current = run.catch(() => undefined);
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the latest values are read at call time.
  }, [account, to, cc, bcc, subject, body, signature, files, sourceFiles, snapshot]);

  // Autosave a few seconds after the last change.
  useEffect(() => {
    if (!unsaved) return;
    const timer = window.setTimeout(() => void save().catch(() => undefined), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saved when the content changes only.
  }, [snapshot, unsaved]);

  // Leaving the page with unsaved changes asks for confirmation.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /**
   * Sends the mail, from its saved draft (deleted once sent).
   * @returns {Promise<void>}
   */
  const submit = async () => {
    if (!account) return;
    await saving.current;
    send.mutate(
      { ...fields(), accountId: account.id, draft: draft.current },
      {
        onSuccess: (projectIds) => {
          setSavedSnapshot(snapshot);
          notifySuccess(projectIds.length ? 'Mail envoyé et rattaché au projet.' : 'Mail envoyé.');
          options.onSent?.();
          onDone();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  /**
   * Schedules the mail (built now with its files, sent at its time); its draft is removed.
   * @param {Date} sendAt Time to send it.
   * @returns {Promise<void>}
   */
  const scheduleAt = async (sendAt: Date) => {
    if (!account) return;
    await saving.current;
    schedule.mutate(
      { input: { ...fields(), accountId: account.id, draft: draft.current }, sendAt: sendAt.toISOString() },
      {
        onSuccess: () => {
          setSavedSnapshot(snapshot);
          notifySuccess(`Envoi programmé le ${scheduleFormat.format(sendAt)}.`);
          onDone();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  /**
   * Deletes the saved draft, if any.
   * @returns {Promise<void>}
   */
  const discard = async () => {
    await saving.current;
    if (draft.current) await deleteDraft.mutateAsync(draft.current);
  };

  /**
   * Closing: with something written, asks whether to keep the draft.
   * @returns {void}
   */
  const requestClose = () => {
    if (!hasContent && !draft.current) {
      onDone();
      return;
    }
    closing.current = true;
    setAskingClose(true);
  };

  // Escape asks to close (unless a list or the closing question handles it).
  const requestCloseRef = useRef(() => undefined as void);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || closing.current) return;
      // An open list (recipients, account…) closes first.
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[aria-expanded="true"]')) return;
      requestCloseRef.current();
    };
    // Capture: the modal stops Escape before it reaches the window.
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, []);

  if (accounts && accounts.length === 0) {
    return (
      <Stack gap="md">
        <Text size="sm">Configurez d’abord une boîte mail dans les paramètres (onglet « Mails »).</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Fermer
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Modal
        opened={askingClose}
        onClose={() => {
          closing.current = false;
          setAskingClose(false);
        }}
        title="Fermer le mail"
        centered
        zIndex={300}
      >
        <Stack gap="md">
          <Text size="sm">
            Enregistrez le brouillon pour reprendre ce mail plus tard (dossier Brouillons de la boîte), ou supprimez-le : il
            sera alors perdu définitivement.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              color="red"
              variant="light"
              onClick={() => {
                setAskingClose(false);
                void discard()
                  .then(() => {
                    notifySuccess('Brouillon supprimé.');
                    onDone();
                  })
                  .catch((error: Error) => notifyError(error.message))
                  .finally(() => {
                    closing.current = false;
                  });
              }}
            >
              Supprimer le brouillon
            </Button>
            <Button
              onClick={() => {
                setAskingClose(false);
                void save()
                  .then(() => {
                    notifySuccess('Brouillon enregistré.');
                    onDone();
                  })
                  .catch((error: Error) => notifyError(error.message))
                  .finally(() => {
                    closing.current = false;
                  });
              }}
            >
              Enregistrer le brouillon
            </Button>
            <Button
              variant="default"
              onClick={() => {
                closing.current = false;
                setAskingClose(false);
              }}
            >
              Continuer la rédaction
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c={saveState.status === 'error' ? 'red' : 'dimmed'} aria-live="polite">
          {saveState.status === 'saving' && 'Enregistrement du brouillon…'}
          {saveState.status === 'saved' && `Brouillon enregistré à ${timeFormat.format(saveState.at)}`}
          {saveState.status === 'error' && 'Brouillon non enregistré : nouvel essai à la prochaine modification.'}
        </Text>
        <Tooltip label="Fermer">
          <ActionIcon variant="subtle" color="gray" aria-label="Fermer le mail" onClick={requestClose}>
            <XIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Select
        label="De"
        data={(accounts ?? []).map((item) => ({ value: item.id, label: item.displayName ? `${item.displayName} <${item.email}>` : item.email }))}
        value={account?.id ?? null}
        onChange={setAccountId}
        allowDeselect={false}
      />
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <RecipientsInput label="À" value={to} onChange={setTo} autoFocus={to.length === 0} />
        </div>
        {!showCopies && (
          <Anchor component="button" type="button" size="sm" mb={8} onClick={() => setShowCopies(true)}>
            Cc / Cci
          </Anchor>
        )}
      </Group>
      {showCopies && (
        <>
          <RecipientsInput label="Cc" value={cc} onChange={setCc} />
          <RecipientsInput label="Cci" value={bcc} onChange={setBcc} />
        </>
      )}
      <TextInput label="Objet" value={subject} onChange={(event) => setSubject(event.currentTarget.value)} />
      <RichEditor value={body} onChange={setBody} minHeight={220} autoFocus={to.length > 0} />
      {account?.signature && (
        <Stack gap={4}>
          <Checkbox label="Ajouter la signature" checked={withSignature} onChange={(event) => setWithSignature(event.currentTarget.checked)} />
          {withSignature && (
            <Paper withBorder p="xs" radius="sm">
              <MailBody html={account.signature} text={null} />
            </Paper>
          )}
        </Stack>
      )}
      {options.quote && (
        <Stack gap={4}>
          <Anchor component="button" type="button" size="sm" onClick={() => setShowQuote((value) => !value)}>
            {showQuote ? 'Masquer' : 'Afficher'} le message {options.forwarding ? 'transféré' : 'cité'}
          </Anchor>
          <Collapse expanded={showQuote}>
            <Paper withBorder p="xs" radius="sm">
              <MailBody html={options.quote} text={null} />
            </Paper>
          </Collapse>
        </Stack>
      )}
      {(files.length > 0 || (sourceFiles?.files.length ?? 0) > 0) && (
        <Group gap="xs">
          {sourceFiles?.files.map((file) => (
            <Paper key={`source-${file.index}`} withBorder px="xs" py={2} radius="sm">
              <Group gap={4} wrap="nowrap">
                <Text size="xs">
                  {file.filename} · {fileSize(file.size)}
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  aria-label={`Retirer ${file.filename}`}
                  onClick={() => setSourceFiles({ ...sourceFiles, files: sourceFiles.files.filter((item) => item.index !== file.index) })}
                >
                  <XIcon aria-hidden />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
          {files.map((file, index) => (
            <Paper key={`${file.name}-${index}`} withBorder px="xs" py={2} radius="sm">
              <Group gap={4} wrap="nowrap">
                <Text size="xs">
                  {file.name} · {fileSize(file.size)}
                </Text>
                <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Retirer ${file.name}`} onClick={() => setFiles(files.filter((_, item) => item !== index))}>
                  <XIcon aria-hidden />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Group>
      )}
      <Group justify="space-between">
        <FileButton multiple onChange={(picked) => setFiles([...files, ...picked])}>
          {(props) => (
            <Button variant="default" leftSection={<PaperclipIcon aria-hidden />} {...props}>
              Joindre des fichiers
            </Button>
          )}
        </FileButton>
        <Group gap="sm">
          <Button variant="default" onClick={requestClose}>
            Fermer
          </Button>
          <Popover opened={scheduling} onChange={setScheduling} position="top-end" shadow="md" withinPortal={false} trapFocus>
            <Popover.Target>
              <Button
                variant="light"
                leftSection={<ClockCountdownIcon aria-hidden />}
                disabled={!account || recipients.length === 0 || invalid}
                loading={schedule.isPending}
                onClick={() => setScheduling((open) => !open)}
              >
                Programmer
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs" w={260}>
                <Text size="sm" fw={600}>
                  Envoyer plus tard
                </Text>
                {schedulePresets().map((preset) => (
                  <Button key={preset.label} size="xs" variant="default" justify="space-between" onClick={() => void scheduleAt(preset.at)} rightSection={<Text size="xs" c="dimmed">{scheduleFormat.format(preset.at)}</Text>}>
                    {preset.label}
                  </Button>
                ))}
                <DateTimePicker
                  label="Date et heure"
                  placeholder="Choisir…"
                  valueFormat="DD/MM/YYYY HH:mm"
                  minDate={new Date()}
                  value={sendAt}
                  onChange={setSendAt}
                  popoverProps={{ withinPortal: false }}
                />
                <Button size="xs" disabled={!sendAt} onClick={() => sendAt && void scheduleAt(new Date(sendAt.replace(' ', 'T')))}>
                  Programmer l’envoi
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Button
            leftSection={<PaperPlaneTiltIcon aria-hidden />}
            loading={send.isPending}
            disabled={!account || recipients.length === 0 || invalid}
            onClick={() => void submit()}
          >
            Envoyer
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
