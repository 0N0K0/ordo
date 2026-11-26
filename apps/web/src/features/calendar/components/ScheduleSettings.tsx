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
import { unarchived } from '../../../lib/archive';

import { useBirthdayLook, useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules } from '../api';
import { useScheduleConversion } from '../hooks/use-schedule-conversion';
import { ScheduleLookEditor } from './ScheduleLookEditor';
import { UnavailableSwitch } from './UnavailableSwitch';
import { LookPanel, LookToggle } from './LookToggle';
import { SubscriptionRow } from './SubscriptionRow';
import { ActionButton } from '../../../components/actions/ActionButton';
import { inWorkspace } from '../lib/layer-label';

interface KindLookSettingsProps {
  title: string;
  description?: string;
  /** Name of what is set, for the labels (« des créneaux sans type »). */
  of: string;
  /** Placeholder of the color (the one without any). */
  colorPlaceholder: string;
  color: string | null;
  /** Saves the color. */
  onColor: (color: string | null) => void;
  /** Its display in the calendar, as a kind (none: it has no display to choose). */
  display?: {
    /** Name for the look editor. */
    name: string;
    value: { dayDisplay: string; dayBar: boolean; monthDisplay: string };
    onChange: (display: ScheduleDisplay) => void;
  };
  /** What else is set on the row (a label, whether shown). */
  children: ReactNode;
}

/**
 * Settings row of what shows in the calendar without being an item of the list of kinds (the schedules without kind,
 * the birthdays): its color, what else it has, and its display in the calendar when it has one (`ScheduleLookEditor`).
 * @param {KindLookSettingsProps} props Component props.
 * @returns {JSX.Element} Section.
 */
function KindLookSettings({ title, description, of, colorPlaceholder, color, onColor, display, children }: KindLookSettingsProps) {
  const [opened, setOpened] = useState(false);
  return (
    <SettingsSection title={title} description={description}>
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <ColorField
            key={color ?? 'none'}
            size="xs"
            w={120}
            placeholder={colorPlaceholder}
            aria-label={`Couleur ${of}`}
            defaultValue={color ?? ''}
            onCommit={(value) => onColor(value || null)}
          />
          {children}
          {display && <LookToggle label="Affichage dans l’agenda" ariaLabel={`Affichage ${of}`} opened={opened} onToggle={() => setOpened(!opened)} />}
        </Group>
        {display && (
          <LookPanel opened={opened}>
            <ScheduleLookEditor name={display.name} value={display.value} onChange={display.onChange} />
          </LookPanel>
        )}
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
  const current = { label: defaultKind.label, color: defaultKind.color, ...readScheduleDisplay(defaultKind) };
  return (
    <KindLookSettings
      title="Créneaux sans type"
      of="des créneaux sans type"
      colorPlaceholder="Vert"
      color={defaultKind.color}
      onColor={(color) => saveDefaultKind.mutate({ ...current, color }, ON_ERROR)}
      display={{ name: defaultKind.label, value: defaultKind, onChange: (display) => saveDefaultKind.mutate({ ...current, ...display }, ON_ERROR) }}
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
        onBlur={(event) => event.currentTarget.value.trim() !== defaultKind.label && saveDefaultKind.mutate({ ...current, label: event.currentTarget.value }, ON_ERROR)}
      />
    </KindLookSettings>
  );
}

/**
 * Birthdays of the people of the workspace, all-day events of the calendar: shown in it or not (hidden, their
 * reminders still ring) and their color (none: the gray of the éphémérides).
 * @returns {JSX.Element | null} Section.
 */
function BirthdayLookSettings() {
  const { saveBirthdayLook } = useWorkScheduleMutations();
  const { data: look } = useBirthdayLook();
  if (!look) return null;
  return (
    <KindLookSettings
      title="Anniversaires"
      description="Les anniversaires des membres de l’équipe ou du foyer et des relations, tirés de leur date de naissance : des évènements d’une journée entière dans l’agenda, dans leur couleur. Masqués, leurs rappels sonnent toujours."
      of="des anniversaires"
      colorPlaceholder="Gris"
      color={look.color}
      onColor={(color) => saveBirthdayLook.mutate({ shown: look.shown, color }, ON_ERROR)}
    >
      <Switch
        size="xs"
        style={{ flex: 1 }}
        label="Afficher dans l’agenda"
        checked={look.shown}
        onChange={(event) => saveBirthdayLook.mutate({ color: look.color, shown: event.currentTarget.checked }, ON_ERROR)}
      />
    </KindLookSettings>
  );
}

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…) or of éphémérides (holidays, school holidays, birthdays…), as every settings list: label, color, image and display in the calendar, reordered by drag and drop; a kind of
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
      renderBadges={(type) => (
        <>
          {type.unavailable && (
            <Badge size="xs" variant="light" color="gray">
              Indisponible
            </Badge>
          )}
          {type.budgetContext && (
            <Badge size="xs" variant="light">
              {type.sharedContext ? 'Contexte du budget, partagé' : 'Contexte du budget'}
            </Badge>
          )}
        </>
      )}
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
 * display of the kind, or those set here, and « Indisponible » here or not (whatever its own workspace says); an
 * archived kind is not offered.
 * @returns {JSX.Element | null} Section, nothing without other workspaces with schedules.
 */
function ForeignSchedules() {
  // An archived kind is not offered (archiving it removed its subscriptions).
  const kinds = unarchived(useForeignScheduleKinds().data ?? []);
  const { subscribe, unsubscribe, setLook, setSubscriptionUnavailable } = useWorkScheduleMutations();
  const [opened, setOpened] = useState<string | null>(null);
  if (!kinds.length) return null;
  return (
    <SettingsSection
      title="Créneaux des autres espaces"
      description="Abonné à un type de créneau, cet espace affiche tous ses créneaux (même ceux ajoutés ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici ; « Indisponible » s’y règle pour cet espace seul."
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
                hint={`${kind.ephemeris ? countOf(kind.scheduleCount, 'éphéméride') : countOf(kind.scheduleCount, 'créneau', 'créneaux')}${kind.customized ? ' · affichage personnalisé' : ''}${kind.subscribed && kind.unavailable ? ' · indisponible ici' : ''}`}
                subscribed={kind.subscribed}
                onChange={(subscribed) => (subscribed ? subscribe : unsubscribe).mutate(target, ON_ERROR)}
                actions={
                  kind.subscribed && (
                    <LookToggle
                      label="Couleur, affichage et disponibilité dans cet agenda"
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
                  <UnavailableSwitch size="xs" checked={kind.unavailable} onChange={(unavailable) => setSubscriptionUnavailable.mutate({ ...target, unavailable }, ON_ERROR)} />
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
 * and display, the kinds of éphémérides beside them and the birthdays after them, and the
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
