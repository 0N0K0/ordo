import { Badge, Group, Paper, Text, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router';
import type { Project, ProjectStatus } from '../api';
import { EntityAvatar } from '../EntityAvatar';

interface ProjectListProps {
  projects: Project[];
  /** Id of the parent of the top-level rows (null: root projects). */
  rootParentId: string | null;
  statuses: ProjectStatus[];
}

/**
 * Bordered list of projects with their sub-projects indented (active first, then archived).
 * @param {ProjectListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function ProjectList({ projects, rootParentId, statuses }: ProjectListProps) {
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const rows: { project: Project; depth: number }[] = [];

  /**
   * Appends the children of a parent, recursively.
   * @param {string | null} parentId Parent id.
   * @param {number} depth Depth of the children.
   * @returns {void}
   */
  const walk = (parentId: string | null, depth: number) => {
    projects
      .filter((project) => project.parentId === parentId)
      .sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position)
      .forEach((project) => {
        rows.push({ project, depth });
        walk(project.id, depth + 1);
      });
  };
  walk(rootParentId, 0);

  return (
    <Paper withBorder radius="md">
      {rows.map(({ project, depth }, index) => {
        const status = project.statusId ? statusById.get(project.statusId) : undefined;
        return (
          <UnstyledButton
            key={project.id}
            component={Link}
            to={`/projects/${project.id}`}
            p="sm"
            pl={`calc(var(--mantine-spacing-sm) + ${depth} * var(--mantine-spacing-lg))`}
            display="block"
            style={index > 0 ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}
          >
            <Group gap="sm" wrap="nowrap">
              <EntityAvatar name={project.title} iconUrl={project.iconUrl} color={project.color} size="sm" />
              <Text size="sm" style={{ flex: 1 }} opacity={project.archived ? 0.6 : 1} truncate>
                {project.title}
              </Text>
              {status && (
                <Badge variant="light" color={status.color}>
                  {status.name}
                </Badge>
              )}
              {project.archived && (
                <Badge variant="light" color="gray">
                  Archivé
                </Badge>
              )}
            </Group>
          </UnstyledButton>
        );
      })}
    </Paper>
  );
}
