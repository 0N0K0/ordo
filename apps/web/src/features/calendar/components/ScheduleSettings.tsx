import { useScheduleTypeItems } from '../hooks/use-settings-items';
import { ColorField } from '../../../components/inputs/ColorField';
import { countOf } from '../../../lib/text';
import { Badge, Group, Stack, Text, TextInput } from '@mantine/core';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ByWorkspace } from './ByWorkspace';

import { DEFAULT_SCHEDULE_KIND_LABEL, foreignSlotKind, readScheduleDisplay } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ON_ERROR } from '../../../lib/notify';

import { useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations } from '../api';
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
    <SettingsSection title="Plages sans type">
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <ColorField
            key={defaultKind.color ?? 'none'}
            size="xs"
            w={120}
            placeholder="Vert"
            aria-label="Couleur des plages sans type"
            defaultValue={defaultKind.color ?? ''}
            onChangeEnd={(value) => saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), color: value || null }, ON_ERROR)}
          />
          <TextInput
            key={defaultKind.label}
            size="xs"
            style={{ flex: 1 }}
            aria-label="Libellé des plages sans type"
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
          <LookToggle label="Affichage dans l’agenda" ariaLabel="Affichage des plages sans type" opened={opened} onToggle={() => setOpened(!opened)} />
        </Group>
        <LookPanel opened={opened}>
          <ScheduleLookEditor name={defaultKind.label} value={defaultKind} onChange={(display) => saveDefaultKind.mutate({ ...defaultKind, ...display }, ON_ERROR)} />
        </LookPanel>
      </Stack>
    </SettingsSection>
  );
}

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…), as every settings list: label, color, image and display in the
 * calendar, reordered by drag and drop.
 * @returns {JSX.Element} Section.
 */
function ScheduleTypes() {
  const { data: types } = useScheduleTypes();
  const { removeType } = useWorkScheduleMutations();
  const kind = useScheduleTypeItems();
  return (
    <SettingsList
      {...kind}
      title="Types de plages"
      description="Pour distinguer vos plages (travail, garde des enfants, sport…) : chaque type a sa couleur et son affichage dans l’agenda."
      noun="le type"
      items={types ?? []}
      remove={(id) => removeType.mutateAsync(id)}
      deleteMessage={(type) => <>Le type « {type.label} » sera supprimé ; ses plages restent, sans type.</>}
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
      title="Plages des autres espaces"
      description="Abonné à un type de plage, cet espace affiche toutes ses plages (même celles ajoutées ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici."
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
                hint={`${countOf(kind.scheduleCount, 'plage')}${kind.customized ? ' · affichage personnalisé' : ''}`}
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
                      onChangeEnd={(value) => setLook.mutate({ ...target, input: { ...look, color: value || null } }, ON_ERROR)}
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
 * and display, and the subscriptions to kinds of other workspaces.
 * @returns {JSX.Element} Settings.
 */
export function ScheduleSettings() {
  return (
    <Stack gap="md">
      <DefaultScheduleKind />
      <ScheduleTypes />
      <ForeignSchedules />
    </Stack>
  );
}
