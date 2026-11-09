import { Stack, Tabs, Title } from "@mantine/core";
import { BuildingsIcon, FoldersIcon, GithubLogoIcon, ListChecksIcon, SquaresFourIcon, UsersIcon } from "@phosphor-icons/react";
import { Navigate, useSearchParams } from "react-router";
import { LabelManager } from "../../../components/settings/LabelManager";
import { CompanySettings } from "../../accounting/CompanySettings";
import { GithubSettings } from "../../github/GithubSettings";
import { useTasksData } from "../../tasks/api";
import { ContributorsManager } from "../../tasks/settings/ContributorsManager";
import { TaskSettings } from "../../tasks/settings/TaskSettings";
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
import { SettingsGrid, WideSetting } from "../../../components/settings/SettingsGrid";

/**
 * Settings, in tabs: projects (statuses, categories), team or household, contributors and relations, tasks (statuses,
 * priorities, types), GitHub, company (not in a personal workspace) and the workspaces. The tab is kept in the URL (?tab=). The settings of
 * the document tracking, the calendar and the mail accounts are in their own views (old links lead there).
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
  // A personal workspace has no company nor invoicing.
  const tab = perso && asked === "company" ? "projects" : asked;
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
  const moved: Record<string, string> = { tracking: perso ? "/" : "/accounting?tab=tracking", calendar: "/calendar?settings=1", mail: "/mail?accounts=1" };
  if (moved[asked]) return <Navigate to={moved[asked]} replace />;

  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        Paramètres
      </Title>
      <Tabs
        value={tab}
        onChange={(value) =>
          setParams(value && value !== "projects" ? { tab: value } : {})
        }
        keepMounted={false}
      >
        <Tabs.List mb="lg">
          <Tabs.Tab value="projects" leftSection={<FoldersIcon aria-hidden />}>
            Projets
          </Tabs.Tab>
          <Tabs.Tab value="contributors" leftSection={<UsersIcon aria-hidden />}>
            {perso ? "Foyer et contributeurs" : "Équipe et contributeurs"}
          </Tabs.Tab>
          <Tabs.Tab value="tasks" leftSection={<ListChecksIcon aria-hidden />}>
            Tâches
          </Tabs.Tab>
          <Tabs.Tab value="github" leftSection={<GithubLogoIcon aria-hidden />}>
            GitHub
          </Tabs.Tab>
          {!perso && (
            <Tabs.Tab value="company" leftSection={<BuildingsIcon aria-hidden />}>
              Société
            </Tabs.Tab>
          )}
          <Tabs.Tab value="workspaces" leftSection={<SquaresFourIcon aria-hidden />}>
            Espaces
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="projects">
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
        </Tabs.Panel>
        <Tabs.Panel value="tasks">
          <TaskSettings />
        </Tabs.Panel>
        <Tabs.Panel value="contributors">
          <SettingsGrid>
            <TeamMembers />
            <TeamRelations />
            {/* The list of contributors is a wide table. */}
            <WideSetting>
              <ContributorsManager
                contributors={taskData?.contributors ?? []}
                usage={assigneeUsage}
              />
            </WideSetting>
          </SettingsGrid>
        </Tabs.Panel>
        <Tabs.Panel value="company">
          <CompanySettings />
        </Tabs.Panel>
        <Tabs.Panel value="github">
          <GithubSettings />
        </Tabs.Panel>
        <Tabs.Panel value="workspaces">
          <WorkspacesManager />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
