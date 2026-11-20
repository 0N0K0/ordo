import { useScheduleTypeItems } from '../hooks/use-settings-items';
import { ColorField } from '../../../components/inputs/ColorField';
import { countOf } from '../../../lib/text';
import { Badge, Group, Stack, Text, TextInput } from '@mantine/core';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ByWorkspace } from './ByWorkspace';

import { DEFAULT_SCHEDULE_KIND_LABEL, EVERYDAY_CONTEXT, foreignSlotKind, readScheduleDisplay } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ON_ERROR } from '../../../lib/notify';

import { useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules } from '../api';
import { useScheduleConversion } from '../hooks/use-schedule-conversion';
import { ScheduleLookEditor } from './ScheduleLookEditor';
import { LookPanel, LookToggle } from './LookToggle';
import { SubscriptionRow } from './SubscriptionRow';
import { ActionButton } from '../../../components/actions/ActionButton';
import { inWorkspace } from '../lib/layer-label';

/**
 * Schedules without kind: their label, color and display in the calendar (a setting apart, not an item of the list of
 * kinds).
 * @returns {JSX.Element | null} Section.
 */
function DefaultScheduleKind() {
  const { saveDefaultKind } = useWorkScheduleMutations();
  const { data: defaultKind } = useDefaultScheduleKind();
  const [opened, setOpened] = useState(false);
  if (!defaultKind) return null;
  return (
    <SettingsSection title="Créneaux sans type">
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <ColorField
            key={defaultKind.color ?? 'none'}
            size="xs"
            w={120}
            placeholder="Vert"
            aria-label="Couleur des créneaux sans type"
            defaultValue={defaultKind.color ?? ''}
            onCommit={(value) => saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), color: value || null }, ON_ERROR)}
          />
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
              event.currentTarget.value.trim() !== defaultKind.label && saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), label: event.currentTarget.value }, ON_ERROR)
            }
          />
          <LookToggle label="Affichage dans l’agenda" ariaLabel="Affichage des créneaux sans type" opened={opened} onToggle={() => setOpened(!opened)} />
        </Group>
        <LookPanel opened={opened}>
          <ScheduleLookEditor name={defaultKind.label} value={defaultKind} onChange={(display) => saveDefaultKind.mutate({ ...defaultKind, ...display }, ON_ERROR)} />
        </LookPanel>
      </Stack>
    </SettingsSection>
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
 * and display, the kinds of éphémérides beside them (lot 16), and the subscriptions to kinds of other workspaces.
 * @returns {JSX.Element} Settings.
 */
export function ScheduleSettings() {
  return (
    <Stack gap="md">
      <DefaultScheduleKind />
      <ScheduleTypes ephemeris={false} />
      <ScheduleTypes ephemeris />
      <ForeignSchedules />
    </Stack>
  );
}
