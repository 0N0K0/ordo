import { useSetParams } from '../../../lib/search-params';
import { PageHeader } from '../../../components/actions/PageHeader';
import { Stack } from "@mantine/core";
import { FoldersIcon, GithubLogoIcon, MapPinIcon, SquaresFourIcon, UsersIcon } from "@phosphor-icons/react";
import { Navigate, useSearchParams } from "react-router";
import { labelFormSchema } from "@ordo/shared";
import { listMutations } from "../../../components/settings/settings-api";
import { SettingsList } from "../../../components/settings/SettingsList";
import { GithubSettings } from "../../github/components/GithubSettings";
import { PlacesManager } from "../../geo/components/PlacesManager";
import { useTasksData } from "../../tasks/api";
import { ContributorsManager } from "../../tasks/components/ContributorsManager";
import { TeamMembers, TeamRelations } from "../../treasury/components/TeamPanel";
import { useActiveWorkspace } from "../../workspaces/api";
import { WorkspacesManager } from "../../workspaces/components/WorkspacesManager";
import {
  useCreateProjectCategory,
  useCreateProjectStatus,
  useDeleteProjectCategory,
  useDeleteProjectStatus,
  useUpdateProjectCategory,
  useUpdateProjectStatus,
  useWorkspace,
} from "../api";
import { SettingsGrid } from "../../../components/settings/SettingsGrid";
import { PageTabs } from '../../../components/tabs/PageTabs';

/**
 * Settings of the whole workspace, in tabs: projects (statuses, categories), team or household, contributors and
 * relations, places (of the events, routines, travel times…), GitHub and the workspaces. The tab is kept in the URL (?tab=). The settings of the tasks (in every view of
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

  const { data: taskData } = useTasksData();
  const [params] = useSearchParams();
  const setParams = useSetParams();
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
          setParams({ tab: value && value !== "projects" ? value : null }, { only: true })
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
          <PageTabs.Tab value="places" leftSection={<MapPinIcon aria-hidden />}>
            Lieux
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
            <SettingsList
              kind="PROJECT_STATUS"
              title="Statuts de projet"
              description="Un projet a au plus un statut. L’ordre est celui des listes de sélection."
              noun="le statut"
              usageNoun="projets"
              items={data?.projectStatuses ?? []}
              usage={statusUsage}
              schema={labelFormSchema}
              {...listMutations({ create: createStatus, update: updateStatus, remove: deleteStatus })}
            />
            <SettingsList
              kind="PROJECT_CATEGORY"
              title="Catégories de projet"
              description="Un projet peut avoir plusieurs catégories."
              noun="la catégorie"
              usageNoun="projets"
              items={data?.projectCategories ?? []}
              usage={categoryUsage}
              schema={labelFormSchema}
              {...listMutations({ create: createCategory, update: updateCategory, remove: deleteCategory })}
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
        {/* Places of the events, the routines, the travel times… of the whole app. */}
        <PageTabs.Panel value="places">
          <PlacesManager />
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
