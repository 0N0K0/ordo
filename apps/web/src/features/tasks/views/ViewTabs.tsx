import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { closePanel, openPanel } from '../../../components/panels/panels';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Button, Group, Indicator, Menu, Stack, Tabs, Text, TextInput, type TabsTabProps } from '@mantine/core';
import { taskViewNameSchema } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, ArrowLeftIcon, ArrowRightIcon, CaretDownIcon, CopyIcon, FloppyDiskIcon, PencilSimpleIcon, PlusIcon, StarIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { SavedView, SavedViewsState } from './use-saved-views';

interface NameFormProps {
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/**
 * View name prompt (create, rename).
 * @param {NameFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function NameForm({ initial, submitLabel, onSubmit, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates and submits the name.
   * @returns {void}
   */
  const submit = () => {
    const result = taskViewNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Nom invalide.');
      return;
    }
    onSubmit(result.data);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <Stack gap="md">
        <TextInput
          label="Nom de la vue"
          required
          data-autofocus
          value={name}
          error={error}
          onChange={(event) => {
            setName(event.currentTarget.value);
            setError(null);
          }}
          onBlur={() => !taskViewNameSchema.safeParse(name).success && setError('Le nom est requis.')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}

let modalCount = 0;

/**
 * Asks for a view name in the side panel.
 * @param {string} title Modal title.
 * @param {string} initial Initial name.
 * @param {string} submitLabel Submit button label.
 * @param {(name: string) => void} onSubmit Called with the name.
 * @returns {void}
 */
function promptName(title: string, initial: string, submitLabel: string, onSubmit: (name: string) => void): void {
  const modalId = `view-name-${++modalCount}`;
  const close = () => closePanel(modalId);
  openPanel({
    panelId: modalId,
    title,
    children: (
      <NameForm
        initial={initial}
        submitLabel={submitLabel}
        onCancel={close}
        onSubmit={(name) => {
          close();
          onSubmit(name);
        }}
      />
    ),
  });
}

/**
 * Tab of a view that can be dragged along the tab list (a click still selects it: the drag starts after a
 * few pixels).
 * @param {TabsTabProps & { value: string }} props Tab props.
 * @returns {JSX.Element} Tab.
 */
function SortableTab(props: TabsTabProps & { value: string }) {
  // Pointer only: the tab keeps its role and keyboard navigation (its menu moves the view with the keyboard).
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: props.value });
  return (
    <Tabs.Tab
      ref={setNodeRef}
      {...props}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, y: 0 }), transition, zIndex: isDragging ? 1 : undefined, cursor: isDragging ? 'grabbing' : undefined }}
    />
  );
}

/**
 * Tabs of the saved views, reordered by drag and drop; the menu of the current one saves or reverts its changes
 * (also at the top of the « Options » menu).
 * @param {{ state: SavedViewsState<C> }} props Component props.
 * @returns {JSX.Element} Tabs.
 */
export function ViewTabs<C>({ state }: { state: SavedViewsState<C> }) {
  const { views, current, dirty } = state;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /**
   * Moves the dropped view to its new place.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = views.findIndex((view) => view.id === over.id);
    if (index >= 0) state.move(String(active.id), index);
  };

  /**
   * Asks for confirmation before deleting a view.
   * @param {SavedView<C>} view View.
   * @returns {void}
   */
  const confirmDelete = (view: SavedView<C>) => {
    confirmDestructive({
      title: 'Supprimer la vue',
      risks: (
        <>
          <Text size="sm">La vue « {view.name} » et sa configuration (filtres, tris, colonnes) seront supprimées. Les tâches ne sont pas modifiées. Cette action est irréversible.</Text>
        </>
      ),
      onConfirm: () => {
        state.remove(view);
      },
    });
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap={0} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Tabs value={current?.id ?? null} onChange={(id) => id && state.select(id)} style={{ minWidth: 0 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={views.map((view) => view.id)} strategy={horizontalListSortingStrategy}>
              <Tabs.List>
                {views.map((view, index) => {
                  const active = view.id === current?.id;
                  return (
                    <SortableTab
                      key={view.id}
                      value={view.id}
                      leftSection={view.isDefault ? <StarIcon weight="fill" aria-label="Vue par défaut" /> : undefined}
                      rightSection={
                        active ? (
                          <Menu position="bottom-end" withinPortal shadow="md">
                            <Menu.Target>
                              <ActionIcon component="span" variant="subtle" color="gray" size="xs" aria-label={`Actions sur la vue ${view.name}`} onClick={(event) => event.stopPropagation()}>
                                <CaretDownIcon aria-hidden />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {dirty && (
                                <>
                                  <Menu.Label>Modifications non enregistrées</Menu.Label>
                                  <Menu.Item leftSection={<FloppyDiskIcon aria-hidden />} onClick={state.save}>
                                    Enregistrer
                                  </Menu.Item>
                                  <Menu.Item leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={state.revert}>
                                    Annuler les modifications
                                  </Menu.Item>
                                  <Menu.Divider />
                                </>
                              )}
                              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => promptName('Renommer la vue', view.name, 'Renommer', (name) => state.rename(view.id, name))}>
                                Renommer
                              </Menu.Item>
                              <Menu.Item leftSection={<CopyIcon aria-hidden />} onClick={() => state.duplicate(view)}>
                                Dupliquer
                              </Menu.Item>
                              {!view.isDefault && (
                                <Menu.Item leftSection={<StarIcon aria-hidden />} onClick={() => state.setDefault(view)}>
                                  Définir par défaut
                                </Menu.Item>
                              )}
                              <Menu.Item leftSection={<ArrowLeftIcon aria-hidden />} disabled={index === 0} onClick={() => state.move(view.id, index - 1)}>
                                Déplacer à gauche
                              </Menu.Item>
                              <Menu.Item leftSection={<ArrowRightIcon aria-hidden />} disabled={index === views.length - 1} onClick={() => state.move(view.id, index + 1)}>
                                Déplacer à droite
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" disabled={views.length === 1} onClick={() => confirmDelete(view)}>
                                Supprimer
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        ) : undefined
                      }
                    >
                      <Indicator disabled={!(active && dirty)} size={7} offset={-4} position="top-end" color="orange">
                        {view.name}
                      </Indicator>
                    </SortableTab>
                  );
                })}
              </Tabs.List>
            </SortableContext>
          </DndContext>
        </Tabs>
        <Menu position="bottom-start" withinPortal shadow="md">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" ml="xs" aria-label="Nouvelle vue" title="Nouvelle vue">
              <PlusIcon aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => promptName('Nouvelle vue', 'Nouvelle vue', 'Créer', (name) => state.createView(name, false))}>Vue vierge</Menu.Item>
            <Menu.Item onClick={() => promptName('Nouvelle vue', `${current?.name ?? 'Vue'} (copie)`.slice(0, 60), 'Créer', (name) => state.createView(name, true))}>
              À partir de l’affichage actuel
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
