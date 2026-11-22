import { CONVERSION_LOSSES, type ConversionLoss, type ConversionLossKind } from '@ordo/shared';
import { ArrowsClockwiseIcon, CheckSquareIcon } from '@phosphor-icons/react';
import { List } from '@mantine/core';
import type { ReactNode } from 'react';
import { countWith } from '../../../lib/text';
import type { LossDialog } from '../../time/lib/confirm-loss';

/** Way a task and a routine are turned into each other. */
export type ConversionDirection = 'TASK_TO_ROUTINE' | 'ROUTINE_TO_TASK';

/**
 * What each kind lost is called in the confirmation, from its count.
 * @type {Record<ConversionLossKind, (count: number) => string>}
 */
const LOSS_TEXT: Record<ConversionLossKind, (count: number) => string> = {
  number: () => 'son numéro',
  status: () => 'son statut',
  priority: () => 'sa priorité',
  type: () => 'son type',
  tags: (count) => countWith(count, 'étiquette', ['son', 'ses']),
  milestone: () => 'son jalon',
  sprints: (count) => countWith(count, 'sprint', ['son', 'ses']),
  github: () => 'son lien GitHub (l’item est retiré du tableau)',
  effort: () => 'son effort',
  dates: () => 'ses dates de début et de fin',
  taskLinks: (count) => `${countWith(count, 'lien', ['son', 'ses'])} « Dépend de », « Bloque » ou « Relative à » avec d’autres tâches`,
  shoppingLists: (count) => `son lien avec ${countWith(count, 'liste d’achats', ['sa', 'ses'], 'listes d’achats')}`,
  alarms: (count) => `son lien avec ${countWith(count, 'alarme', ['son', 'ses'])} (gardées, sans tâche)`,
  events: (count) => countWith(count, 'lien avec un évènement', ['son', 'ses'], 'liens avec des évènements'),
  hours: () => 'ses horaires (une routine suit ses moments et sa condition de créneaux)',
  parent: () => 'son parent (elle passe au premier niveau)',
  repetition: () => 'sa répétition',
  checks: (count) => `l’historique de ses occurrences (${countWith(count, 'coche', ['une', 'ses'])})`,
  beforeReminders: (count) => countWith(count, 'rappel « avant »', ['son', 'ses'], 'rappels « avant »'),
  routineLinks: (count) => `${countWith(count, 'lien', ['son', 'ses'])} « Dépend de » ou « Relative à » avec d’autres routines`,
  categories: (count) => countWith(count, 'catégorie', ['sa', 'ses']),
  estimate: () => 'son temps à y consacrer',
  travel: () => 'ses trajets',
  comments: (count) => countWith(count, 'commentaire des autres occurrences', ['le', 'les'], 'commentaires des autres occurrences'),
  checklists: (count) => countWith(count, 'autre liste à cocher', ['son', 'ses'], 'autres listes à cocher'),
};

/** Words of each way: what the item is, what it becomes, what follows it. */
const DIRECTIONS: Record<ConversionDirection, { title: string; what: string; kept: string; confirmLabel: string; icon: ReactNode }> = {
  TASK_TO_ROUTINE: {
    title: 'Transformer en routine',
    what: 'La tâche est remplacée par une routine répétée chaque jour (sa répétition se choisit ensuite dans son panneau) : son échéance devient celle de la première occurrence, qui reçoit ses commentaires et sa liste à cocher ; ses temps et ses fiches la suivent.',
    kept: 'Les liens écrits vers la tâche dans les textes ne mèneront plus nulle part.',
    confirmLabel: 'Transformer en routine',
    icon: <ArrowsClockwiseIcon aria-hidden />,
  },
  ROUTINE_TO_TASK: {
    title: 'Transformer en tâche',
    what: 'La routine est remplacée par une tâche « À faire », datée par son occurrence en cours : elle en reçoit les commentaires, la liste à cocher et les évènements ; ses temps et ses fiches la suivent.',
    kept: '',
    confirmLabel: 'Transformer en tâche',
    icon: <CheckSquareIcon aria-hidden />,
  },
};

/**
 * Confirmation of a conversion between a task and a routine, from what the API counts as lost: what happens,
 * then the list of what is lost, in the order of `CONVERSION_LOSSES`.
 * @param {ConversionDirection} direction Way.
 * @param {ConversionLoss} lost What is lost, by kind.
 * @returns {LossDialog} Dialog.
 */
export function conversionDialog(direction: ConversionDirection, lost: ConversionLoss): LossDialog {
  const { title, what, kept, confirmLabel, icon } = DIRECTIONS[direction];
  const items = CONVERSION_LOSSES.filter((kind) => (lost[kind] ?? 0) > 0).map((kind) => LOSS_TEXT[kind](lost[kind]!));
  return {
    title,
    confirmLabel,
    confirmIcon: icon,
    risks: (
      <>
        {what} {kept}
        {items.length > 0 && (
          <>
            {' '}
            Elle perd :
            <List size="sm" mt={4} mb={4}>
              {items.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </>
        )}
      </>
    ),
  };
}
