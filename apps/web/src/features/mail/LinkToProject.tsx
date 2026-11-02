import { Button, Popover, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FolderSimplePlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useMailActions } from './api';

/**
 * "Rattacher à un projet": a copy of the mail is kept in the chosen project, and the next messages of the
 * conversation follow it.
 * @param {{ accountId: string, folder: string, uid: number, linkedProjectIds: string[] }} props Mail location.
 * @returns {JSX.Element} Button with its popover.
 */
export function LinkToProject({ accountId, folder, uid, linkedProjectIds }: { accountId: string; folder: string; uid: number; linkedProjectIds: string[] }) {
  const { context } = useTaskContext();
  const { link } = useMailActions();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <Popover opened={opened} onChange={(value) => !value && close()} width={340} position="bottom-end" shadow="md" trapFocus>
      <Popover.Target>
        <Button size="xs" variant="light" leftSection={<FolderSimplePlusIcon aria-hidden />} onClick={toggle}>
          Rattacher à un projet
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          {context && (
            <ProjectSelect
              context={context}
              label="Projet"
              value={projectId}
              onChange={setProjectId}
              comboboxProps={{ withinPortal: false }}
              data-autofocus
            />
          )}
          <Button
            disabled={!projectId || linkedProjectIds.includes(projectId)}
            loading={link.isPending}
            onClick={() =>
              projectId &&
              link.mutate(
                { accountId, folder, uid, projectId },
                {
                  onSuccess: () => {
                    notifySuccess('Mail rattaché au projet : les réponses suivantes le seront aussi.');
                    setProjectId(null);
                    close();
                  },
                  onError: (error) => notifyError(error.message),
                },
              )
            }
          >
            Rattacher
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
