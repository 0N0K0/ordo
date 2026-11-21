import { useScheduleTypeItems } from '../hooks/use-settings-items';
import { ColorField } from '../../../components/inputs/ColorField';
import { countOf } from '../../../lib/text';
import { Badge, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ByWorkspace } from './ByWorkspace';

import { DEFAULT_SCHEDULE_KIND_LABEL, EVERYDAY_CONTEXT, foreignSlotKind, readScheduleDisplay, type ScheduleDisplay } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { type ReactNode, useState } from 'react';
import { ON_ERROR } from '../../../lib/notify';

import { useBirthdayLook, useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules } from '../api';
import { useScheduleConversion } from '../hooks/use-schedule-conversion';
import { ScheduleLookEditor } from './ScheduleLookEditor';
import { LookPanel, LookToggle } from './LookToggle';
import { SubscriptionRow } from './SubscriptionRow';
import { ActionButton } from '../../../components/actions/ActionButton';
import { inWorkspace } from '../lib/layer-label';

interface KindLookSettingsProps {
  title: string;
  description?: string;
  /** Name of what is set, for the labels (« des créneaux sans type »). */
  of: string;
  /** Name for the look editor. */
  name: string;
  /** Placeholder of the color (the one without any). */
  colorPlaceholder: string;
  look: { color: string | null; dayDisplay: string; dayBar: boolean; monthDisplay: string };
  /** Saves the color and the display. */
  onSave: (look: { color: string | null } & ScheduleDisplay) => void;
  /** What else is set on the row (a label, whether shown). */
  children: ReactNode;
}

/**
 * Settings row of what shows like a kind without being an item of the list of kinds (the schedules without kind, the
 * birthdays, decision FX): its color, what else it has, and its display in the calendar (`ScheduleLookEditor`).
 * @param {KindLookSettingsProps} props Component props.
 * @returns {JSX.Element} Section.
 */
function KindLookSettings({ title, description, of, name, colorPlaceholder, look, onSave, children }: KindLookSettingsProps) {
  const [opened, setOpened] = useState(false);
  const current = { color: look.color, ...readScheduleDisplay(look) };
  return (
    <SettingsSection title={title} description={description}>
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <ColorField
            key={look.color ?? 'none'}
            size="xs"
            w={120}
            placeholder={colorPlaceholder}
            aria-label={`Couleur ${of}`}
            defaultValue={look.color ?? ''}
            onCommit={(value) => onSave({ ...current, color: value || null })}
          />
          {children}
          <LookToggle label="Affichage dans l’agenda" ariaLabel={`Affichage ${of}`} opened={opened} onToggle={() => setOpened(!opened)} />
        </Group>
        <LookPanel opened={opened}>
          <ScheduleLookEditor name={name} value={look} onChange={(display) => onSave({ ...current, ...display })} />
        </LookPanel>
      </Stack>
    </SettingsSection>
  );
}

/**
 * Schedules without kind: their label, color and display in the calendar (a setting apart, not an item of the list of
 * kinds).
 * @returns {JSX.Element | null} Section.
 */
function DefaultScheduleKind() {
  const { saveDefaultKind } = useWorkScheduleMutations();
  const { data: defaultKind } = useDefaultScheduleKind();
  if (!defaultKind) return null;
  return (
    <KindLookSettings
      title="Créneaux sans type"
      of="des créneaux sans type"
      name={defaultKind.label}
      colorPlaceholder="Vert"
      look={defaultKind}
      onSave={(look) => saveDefaultKind.mutate({ label: defaultKind.label, ...look }, ON_ERROR)}
    >
      <TextInput
        key={defaultKind.label}
        size="xs"
        style={{ flex: 1 }}
        aria-label="Libellé des créneaux sans type"
        placeholder={DEFAULT_SCHEDULE_KIND_LABEL}
        defaultValue={defaultKind.label}
        rightSectionWidth={80}
        rightSection={
          <Badge size="xs" variant="light" color="gray">
            Par défaut
          </Badge>
        }
        onBlur={(event) =>
          event.currentTarget.value.trim() !== defaultKind.label &&
          saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), label: event.currentTarget.value }, ON_ERROR)
        }
      />
    </KindLookSettings>
  );
}

/**
 * Birthdays of the people of the workspace (decision FX): shown in the calendar or not (hidden, their reminders still
 * ring), their color (none: the gray of the éphémérides) and display, as a kind of éphémérides.
 * @returns {JSX.Element | null} Section.
 */
function BirthdayLookSettings() {
  const { saveBirthdayLook } = useWorkScheduleMutations();
  const { data: look } = useBirthdayLook();
  if (!look) return null;
  return (
    <KindLookSettings
      title="Anniversaires"
      description="Les anniversaires des contributeurs et des relations, tirés de leur date de naissance : leur couleur et leur affichage dans l’agenda. Masqués, leurs rappels sonnent toujours."
      of="des anniversaires"
      name="Anniversaires"
      colorPlaceholder="Gris"
      look={look}
      onSave={(value) => saveBirthdayLook.mutate({ shown: look.shown, ...value }, ON_ERROR)}
    >
      <Switch
        size="xs"
        style={{ flex: 1 }}
        label="Afficher dans l’agenda"
        checked={look.shown}
        onChange={(event) => saveBirthdayLook.mutate({ color: look.color, ...readScheduleDisplay(look), shown: event.currentTarget.checked }, ON_ERROR)}
      />
    </KindLookSettings>
  );
}

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…) or of éphémérides (holidays, school holidays, birthdays…, lot
 * 16), as every settings list: label, color, image and display in the calendar, reordered by drag and drop; a kind of
 * éphémérides may serve as a context of the budget (shared between workspaces or not). « Convertir » turns a whole
 * kind into the other nature, its schedules with it.
 * @param {{ ephemeris: boolean }} props Component props: the kinds of éphémérides, or of créneaux.
 * @returns {JSX.Element} Section.
 */
function ScheduleTypes({ ephemeris }: { ephemeris: boolean }) {
  const { data: types } = useScheduleTypes();
  const { data: schedules } = useWorkSchedules();
  const { removeType } = useWorkScheduleMutations();
  const kind = useScheduleTypeItems({ ephemeris });
  const convert = useScheduleConversion();
  const count = (typeId: string) => (schedules ?? []).filter((schedule) => schedule.typeId === typeId).length;
  return (
    <SettingsList
      {...kind}
      title={ephemeris ? 'Types d’éphémérides' : 'Types de créneaux'}
      description={
        ephemeris
          ? 'Pour distinguer vos éphémérides (vacances, jours fériés, anniversaires…) : chaque type a sa couleur et son affichage dans l’agenda ; il peut servir de contexte au budget.'
          : 'Pour distinguer vos créneaux (travail, garde des enfants, sport…) : chaque type a sa couleur et son affichage dans l’agenda.'
      }
      noun="le type"
      items={(types ?? []).filter((type) => type.ephemeris === ephemeris)}
      renderBadges={(type) =>
        type.budgetContext && (
          <Badge size="xs" variant="light">
            {type.sharedContext ? 'Contexte du budget, partagé' : 'Contexte du budget'}
          </Badge>
        )
      }
      menuItems={(type) => [convert.type(type, count(type.id))]}
      remove={(id) => removeType.mutateAsync(id)}
      deleteMessage={(type) => (
        <>
          Le type « {type.label} » sera supprimé ; {ephemeris ? 'ses éphémérides restent, sans type' : 'ses créneaux restent, sans type'}.
          {type.budgetContext && <> Il cesse d’être un contexte du budget : les lignes qui l’avaient deviennent du « {EVERYDAY_CONTEXT} », ses budgets sont supprimés.</>}
        </>
      )}
    />
  );
}

/**
 * Kinds of schedules of the other workspaces (and their working hours, schedules without kind), by workspace:
 * subscribing to one shows all its schedules, those added later too, read only in this calendar, in the color and
 * display of the kind, or those set here.
 * @returns {JSX.Element | null} Section, nothing without other workspaces with schedules.
 */
function ForeignSchedules() {
  const { data: kinds } = useForeignScheduleKinds();
  const { subscribe, unsubscribe, setLook } = useWorkScheduleMutations();
  const [opened, setOpened] = useState<string | null>(null);
  if (!kinds?.length) return null;
  return (
    <SettingsSection
      title="Créneaux des autres espaces"
      description="Abonné à un type de créneau, cet espace affiche tous ses créneaux (même ceux ajoutés ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici."
    >
      <ByWorkspace items={kinds} workspaceOf={(kind) => ({ id: kind.workspaceId, label: kind.workspaceLabel })}>
        {(kind) => {
          const key = foreignSlotKind(kind.workspaceId, kind.typeId);
          const target = { workspaceId: kind.workspaceId, typeId: kind.typeId ?? null };
          const look = { color: kind.color ?? null, ...readScheduleDisplay(kind) };
          return (
            <Stack key={key} gap={6} pl="md">
              <SubscriptionRow
                label={kind.label}
                color={kind.color ?? 'green'}
                workspaceLabel={kind.workspaceLabel}
                hint={`${kind.ephemeris ? countOf(kind.scheduleCount, 'éphéméride') : countOf(kind.scheduleCount, 'créneau', 'créneaux')}${kind.customized ? ' · affichage personnalisé' : ''}`}
                subscribed={kind.subscribed}
                onChange={(subscribed) => (subscribed ? subscribe : unsubscribe).mutate(target, ON_ERROR)}
                actions={
                  kind.subscribed && (
                    <LookToggle
                      label="Couleur et affichage dans cet agenda"
                      ariaLabel={`Affichage de « ${inWorkspace(kind.label, kind.workspaceLabel)} »`}
                      opened={opened === key}
                      onToggle={() => setOpened(opened === key ? null : key)}
                    />
                  )
                }
              />
              <LookPanel opened={kind.subscribed && opened === key}>
                <Stack gap={6}>
                  <Group gap="xs" align="center">
                    <Text size="xs" w={120}>
                      Couleur
                    </Text>
                    <ColorField
                      key={kind.color ?? 'none'}
                      size="xs"
                      w={140}
                      placeholder="Vert"
                      aria-label={`Couleur de « ${kind.label} » dans cet agenda`}
                      defaultValue={kind.color ?? ''}
                      onCommit={(value) => setLook.mutate({ ...target, input: { ...look, color: value || null } }, ON_ERROR)}
                    />
                  </Group>
                  <ScheduleLookEditor name={kind.label} value={kind} onChange={(display) => setLook.mutate({ ...target, input: { ...look, ...display } }, ON_ERROR)} />
                  {kind.customized && (
                    <div>
                      <ActionButton
                        priority="tertiary"
                        icon={<ArrowCounterClockwiseIcon aria-hidden />}
                        onClick={() => setLook.mutate({ ...target, input: { color: null, dayDisplay: null, dayBar: null, monthDisplay: null } }, ON_ERROR)}
                      >
                        Reprendre ceux du type
                      </ActionButton>
                    </div>
                  )}
                </Stack>
              </LookPanel>
            </Stack>
          );
        }}
      </ByWorkspace>
    </SettingsSection>
  );
}

/**
 * Settings of the time slots, apart from the slots themselves: their kinds (and the default kind) with their color
 * and display, the kinds of éphémérides beside them (lot 16) and the birthdays after them (decision FX), and the
 * subscriptions to kinds of other workspaces.
 * @returns {JSX.Element} Settings.
 */
export function ScheduleSettings() {
  return (
    <Stack gap="md">
      <DefaultScheduleKind />
      <ScheduleTypes ephemeris={false} />
      <ScheduleTypes ephemeris />
      <BirthdayLookSettings />
      <ForeignSchedules />
    </Stack>
  );
}
