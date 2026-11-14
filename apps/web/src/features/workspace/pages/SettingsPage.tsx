import { PageHeader } from '../../../components/actions/PageHeader';
import { Stack } from "@mantine/core";
import { FoldersIcon, GithubLogoIcon, SquaresFourIcon, UsersIcon } from "@phosphor-icons/react";
import { Navigate, useSearchParams } from "react-router";
import { LabelManager } from "../../../components/settings/LabelManager";
import { GithubSettings } from "../../github/GithubSettings";
import { useTasksData } from "../../tasks/api";
import { ContributorsManager } from "../../tasks/settings/ContributorsManager";
import { TeamMembers, TeamRelations } from "../../treasury/TeamPanel";
import { useActiveWorkspace } from "../../workspaces/api";
import { WorkspacesManager } from "../../workspaces/WorkspacesManager";
import {
  useCreateProjectCategory,
  useCreateProjectStatus,
  useDeleteProjectCategory,
  useDeleteProjectStatus,
  useMoveProjectStatus,
  useUpdateProjectCategory,
  useUpdateProjectStatus,
  useWorkspace,
} from "../api";
import { SettingsGrid } from "../../../components/settings/SettingsGrid";
import { PageTabs } from '../../../components/PageTabs';

/**
 * Settings of the whole workspace, in tabs: projects (statuses, categories), team or household, contributors and
 * relations, GitHub and the workspaces. The tab is kept in the URL (?tab=). The settings of the tasks (in every view of
 * tasks), the document tracking and the company (the invoicing), the calendar and the mail accounts are in the settings
 * sidebar of their views (old links lead there).
 * @returns {JSX.Element} Page.
 */
export function SettingsPage() {
  const { data } = useWorkspace();
  const createCategory = useCreateProjectCategory();
  const updateCategory = useUpdateProjectCategory();
  const deleteCategory = useDeleteProjectCategory();
  const createStatus = useCreateProjectStatus();
  const updateStatus = useUpdateProjectStatus();
  const deleteStatus = useDeleteProjectStatus();
  const moveStatus = useMoveProjectStatus();

  const { data: taskData } = useTasksData();
  const [params, setParams] = useSearchParams();
  const { perso } = useActiveWorkspace();
  const asked = params.get("tab") ?? "projects";
  const tab = asked;
  const assigneeUsage = new Map<string, number>();
  for (const task of taskData?.tasks ?? []) {
    for (const id of task.assigneeIds)
      assigneeUsage.set(id, (assigneeUsage.get(id) ?? 0) + 1);
  }

  const projects = data?.projects ?? [];
  const categoryUsage = new Map<string, number>();
  const statusUsage = new Map<string, number>();
  for (const project of projects) {
    for (const category of project.categories)
      categoryUsage.set(category.id, (categoryUsage.get(category.id) ?? 0) + 1);
    if (project.statusId)
      statusUsage.set(
        project.statusId,
        (statusUsage.get(project.statusId) ?? 0) + 1,
      );
  }

  // Settings moved to their views.
  const moved: Record<string, string> = {
    tracking: perso ? "/" : "/accounting?settings=1",
    company: perso ? "/" : "/accounting?settings=1&settingsTab=company",
    calendar: "/calendar?settings=1",
    mail: "/mail?settings=1",
    // In every view of tasks.
    tasks: "/tasks?settings=1",
  };
  if (moved[asked]) return <Navigate to={moved[asked]} replace />;

  return (
    <Stack gap="lg">
      <PageHeader title="Paramètres" />
      <PageTabs
        value={tab}
        onChange={(value) =>
          setParams(value && value !== "projects" ? { tab: value } : {})
        }
        keepMounted={false}
      >
        <PageTabs.List>
          <PageTabs.Tab value="projects" leftSection={<FoldersIcon aria-hidden />}>
            Projets
          </PageTabs.Tab>
          <PageTabs.Tab value="contributors" leftSection={<UsersIcon aria-hidden />}>
            {perso ? "Foyer et contributeurs" : "Équipe et contributeurs"}
          </PageTabs.Tab>
          <PageTabs.Tab value="github" leftSection={<GithubLogoIcon aria-hidden />}>
            GitHub
          </PageTabs.Tab>
          <PageTabs.Tab value="workspaces" leftSection={<SquaresFourIcon aria-hidden />}>
            Espaces
          </PageTabs.Tab>
        </PageTabs.List>
        <PageTabs.Panel value="projects">
          <SettingsGrid>
            <LabelManager
              title="Statuts de projet"
              description="Un projet a au plus un statut. L’ordre est celui des listes de sélection."
              noun="le statut"
              labels={[...(data?.projectStatuses ?? [])].sort(
                (a, b) => a.position - b.position,
              )}
              usage={statusUsage}
              create={createStatus}
              update={updateStatus}
              remove={deleteStatus}
              move={moveStatus}
            />
            <LabelManager
              title="Catégories de projet"
              description="Un projet peut avoir plusieurs catégories."
              noun="la catégorie"
              labels={data?.projectCategories ?? []}
              usage={categoryUsage}
              create={createCategory}
              update={updateCategory}
              remove={deleteCategory}
            />
          </SettingsGrid>
        </PageTabs.Panel>
        <PageTabs.Panel value="contributors">
          <SettingsGrid>
            <TeamMembers />
            <TeamRelations />
            <ContributorsManager
              contributors={taskData?.contributors ?? []}
              usage={assigneeUsage}
            />
          </SettingsGrid>
        </PageTabs.Panel>
        <PageTabs.Panel value="github">
          <GithubSettings />
        </PageTabs.Panel>
        <PageTabs.Panel value="workspaces">
          <WorkspacesManager />
        </PageTabs.Panel>
      </PageTabs>
    </Stack>
  );
}
