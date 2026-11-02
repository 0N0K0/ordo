/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment AlarmFields on Alarm {\n    id\n    title\n    note\n    type\n    startDate\n    time\n    frequency\n    interval\n    weekdays\n    endDate\n    minutes\n    projectId\n    taskId\n    enabled\n    lastFiredAt\n    createdAt\n  }\n": typeof types.AlarmFieldsFragmentDoc,
    "\n  query Alarms {\n    alarms {\n      ...AlarmFields\n    }\n  }\n": typeof types.AlarmsDocument,
    "\n  mutation CreateAlarm($input: AlarmInput!) {\n    createAlarm(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateAlarmDocument,
    "\n  mutation UpdateAlarm($id: ID!, $input: AlarmInput!) {\n    updateAlarm(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateAlarmDocument,
    "\n  mutation DeleteAlarm($id: ID!) {\n    deleteAlarm(id: $id)\n  }\n": typeof types.DeleteAlarmDocument,
    "\n  mutation MarkAlarmFired($id: ID!, $at: DateTime!) {\n    markAlarmFired(id: $id, at: $at)\n  }\n": typeof types.MarkAlarmFiredDocument,
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n    contributorId\n  }\n": typeof types.AccountUserFragmentDoc,
    "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n": typeof types.MeDocument,
    "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation Logout {\n    logout\n  }\n": typeof types.LogoutDocument,
    "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n": typeof types.RequestPasswordResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n": typeof types.ResetPasswordDocument,
    "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n": typeof types.ConfirmEmailChangeDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n": typeof types.ChangePasswordDocument,
    "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n": typeof types.ChangeUsernameDocument,
    "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n": typeof types.RequestEmailChangeDocument,
    "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n": typeof types.CancelEmailChangeDocument,
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n": typeof types.ContributorFieldsFragmentDoc,
    "\n  fragment MilestoneFields on Milestone {\n    id\n    projectId\n    title\n    description\n    dueDate\n    position\n  }\n": typeof types.MilestoneFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": typeof types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    closed\n  }\n": typeof types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": typeof types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n  }\n": typeof types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": typeof types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": typeof types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": typeof types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": typeof types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": typeof types.CloneTaskDocument,
    "\n  mutation MoveTask($id: ID!, $beforeId: ID, $parentId: ID) {\n    moveTask(id: $id, beforeId: $beforeId, parentId: $parentId)\n  }\n": typeof types.MoveTaskDocument,
    "\n  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": typeof types.AddTaskBlockDocument,
    "\n  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": typeof types.RemoveTaskBlockDocument,
    "\n  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {\n    addTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": typeof types.AddTaskRelationDocument,
    "\n  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {\n    removeTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": typeof types.RemoveTaskRelationDocument,
    "\n  mutation AddTaskComment($taskId: ID!, $body: String!) {\n    addTaskComment(taskId: $taskId, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": typeof types.AddTaskCommentDocument,
    "\n  mutation UpdateTaskComment($id: ID!, $body: String!) {\n    updateTaskComment(id: $id, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": typeof types.UpdateTaskCommentDocument,
    "\n  mutation DeleteTaskComment($id: ID!) {\n    deleteTaskComment(id: $id)\n  }\n": typeof types.DeleteTaskCommentDocument,
    "\n  mutation CreateContributor($input: ContributorInput!) {\n    createContributor(input: $input) {\n      ...ContributorFields\n    }\n  }\n": typeof types.CreateContributorDocument,
    "\n  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {\n    updateContributor(id: $id, input: $input) {\n      ...ContributorFields\n    }\n  }\n": typeof types.UpdateContributorDocument,
    "\n  mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {\n    setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)\n  }\n": typeof types.SetProjectContributorsDocument,
    "\n  mutation DeleteContributor($id: ID!) {\n    deleteContributor(id: $id)\n  }\n": typeof types.DeleteContributorDocument,
    "\n      mutation CreateTaskStatus($input: TaskLabelInput!) {\n        createTaskStatus(input: $input) {\n          id\n        }\n      }\n    ": typeof types.CreateTaskStatusDocument,
    "\n      mutation UpdateTaskStatus($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskStatus(id: $id, input: $input) {\n          id\n        }\n      }\n    ": typeof types.UpdateTaskStatusDocument,
    "\n      mutation DeleteTaskStatus($id: ID!) {\n        deleteTaskStatus(id: $id)\n      }\n    ": typeof types.DeleteTaskStatusDocument,
    "\n      mutation MoveTaskStatus($id: ID!, $index: Int!) {\n        moveTaskStatus(id: $id, index: $index)\n      }\n    ": typeof types.MoveTaskStatusDocument,
    "\n      mutation CreateTaskPriority($input: TaskLabelInput!) {\n        createTaskPriority(input: $input) {\n          id\n        }\n      }\n    ": typeof types.CreateTaskPriorityDocument,
    "\n      mutation UpdateTaskPriority($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskPriority(id: $id, input: $input) {\n          id\n        }\n      }\n    ": typeof types.UpdateTaskPriorityDocument,
    "\n      mutation DeleteTaskPriority($id: ID!) {\n        deleteTaskPriority(id: $id)\n      }\n    ": typeof types.DeleteTaskPriorityDocument,
    "\n      mutation MoveTaskPriority($id: ID!, $index: Int!) {\n        moveTaskPriority(id: $id, index: $index)\n      }\n    ": typeof types.MoveTaskPriorityDocument,
    "\n      mutation CreateTaskType($input: TaskLabelInput!) {\n        createTaskType(input: $input) {\n          id\n        }\n      }\n    ": typeof types.CreateTaskTypeDocument,
    "\n      mutation UpdateTaskType($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskType(id: $id, input: $input) {\n          id\n        }\n      }\n    ": typeof types.UpdateTaskTypeDocument,
    "\n      mutation DeleteTaskType($id: ID!) {\n        deleteTaskType(id: $id)\n      }\n    ": typeof types.DeleteTaskTypeDocument,
    "\n      mutation MoveTaskType($id: ID!, $index: Int!) {\n        moveTaskType(id: $id, index: $index)\n      }\n    ": typeof types.MoveTaskTypeDocument,
    "\n  mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!) {\n    setTasksClosed(ids: $ids, closed: $closed)\n  }\n": typeof types.SetTasksClosedDocument,
    "\n  query TaskViews($projectId: ID) {\n    taskViews(projectId: $projectId) {\n      id\n      name\n      config\n      isDefault\n      position\n    }\n  }\n": typeof types.TaskViewsDocument,
    "\n  query MatchingTaskIds($query: TaskQueryInput!) {\n    matchingTaskIds(query: $query)\n  }\n": typeof types.MatchingTaskIdsDocument,
    "\n  mutation CreateTaskView($input: TaskViewInput!) {\n    createTaskView(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateTaskViewDocument,
    "\n  mutation UpdateTaskView($id: ID!, $input: TaskViewUpdateInput!) {\n    updateTaskView(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateTaskViewDocument,
    "\n  mutation DuplicateTaskView($id: ID!, $name: String!) {\n    duplicateTaskView(id: $id, name: $name) {\n      id\n    }\n  }\n": typeof types.DuplicateTaskViewDocument,
    "\n  mutation DeleteTaskView($id: ID!) {\n    deleteTaskView(id: $id)\n  }\n": typeof types.DeleteTaskViewDocument,
    "\n  mutation SetDefaultTaskView($id: ID!) {\n    setDefaultTaskView(id: $id)\n  }\n": typeof types.SetDefaultTaskViewDocument,
    "\n  mutation MoveTaskView($id: ID!, $index: Int!) {\n    moveTaskView(id: $id, index: $index)\n  }\n": typeof types.MoveTaskViewDocument,
    "\n  mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!) {\n    bulkUpdateTasks(ids: $ids, changes: $changes)\n  }\n": typeof types.BulkUpdateTasksDocument,
    "\n  mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID!) {\n    bulkTransferTasks(ids: $ids, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": typeof types.BulkTransferTasksDocument,
    "\n  mutation BulkSetTasksArchived($ids: [ID!]!, $archived: Boolean!) {\n    bulkSetTasksArchived(ids: $ids, archived: $archived)\n  }\n": typeof types.BulkSetTasksArchivedDocument,
    "\n  mutation BulkDeleteTasks($ids: [ID!]!, $deleteSubtasks: Boolean!) {\n    bulkDeleteTasks(ids: $ids, deleteSubtasks: $deleteSubtasks)\n  }\n": typeof types.BulkDeleteTasksDocument,
    "\n  mutation CreateMilestone($input: MilestoneInput!) {\n    createMilestone(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateMilestoneDocument,
    "\n  mutation UpdateMilestone($id: ID!, $input: MilestoneUpdateInput!) {\n    updateMilestone(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateMilestoneDocument,
    "\n  mutation DeleteMilestone($id: ID!) {\n    deleteMilestone(id: $id)\n  }\n": typeof types.DeleteMilestoneDocument,
    "\n  mutation MoveMilestone($id: ID!, $index: Int!) {\n    moveMilestone(id: $id, index: $index)\n  }\n": typeof types.MoveMilestoneDocument,
    "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n  }\n": typeof types.TimeEntryFieldsFragmentDoc,
    "\n  query TimeEntries($projectId: ID) {\n    timeEntries(projectId: $projectId) {\n      ...TimeEntryFields\n    }\n  }\n": typeof types.TimeEntriesDocument,
    "\n  query RunningTimeEntry {\n    runningTimeEntry {\n      ...TimeEntryFields\n    }\n  }\n": typeof types.RunningTimeEntryDocument,
    "\n  mutation StartTimer($input: TimerInput!) {\n    startTimer(input: $input) {\n      id\n    }\n  }\n": typeof types.StartTimerDocument,
    "\n  mutation SetTimerPaused($paused: Boolean!) {\n    setTimerPaused(paused: $paused) {\n      id\n    }\n  }\n": typeof types.SetTimerPausedDocument,
    "\n  mutation StopTimer {\n    stopTimer {\n      id\n    }\n  }\n": typeof types.StopTimerDocument,
    "\n  mutation CreateTimeEntry($input: TimeEntryInput!) {\n    createTimeEntry(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateTimeEntryDocument,
    "\n  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {\n    updateTimeEntry(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateTimeEntryDocument,
    "\n  mutation DeleteTimeEntry($id: ID!) {\n    deleteTimeEntry(id: $id)\n  }\n": typeof types.DeleteTimeEntryDocument,
    "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n": typeof types.ClientFieldsFragmentDoc,
    "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n": typeof types.LabelFieldsFragmentDoc,
    "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n": typeof types.ProjectStatusFieldsFragmentDoc,
    "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n": typeof types.ProjectFieldsFragmentDoc,
    "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.WorkspaceDocument,
    "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n": typeof types.CreateClientDocument,
    "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n": typeof types.UpdateClientDocument,
    "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n": typeof types.SetClientFavoriteDocument,
    "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n": typeof types.SetClientArchivedDocument,
    "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n": typeof types.DeleteClientDocument,
    "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n": typeof types.MoveClientDocument,
    "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n": typeof types.CreateProjectDocument,
    "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n": typeof types.UpdateProjectDocument,
    "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n": typeof types.SetProjectFavoriteDocument,
    "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n": typeof types.SetProjectArchivedDocument,
    "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n": typeof types.DeleteProjectDocument,
    "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n": typeof types.MoveProjectDocument,
    "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n": typeof types.CreateProjectCategoryDocument,
    "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n": typeof types.UpdateProjectCategoryDocument,
    "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n": typeof types.DeleteProjectCategoryDocument,
    "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.CreateProjectStatusDocument,
    "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.UpdateProjectStatusDocument,
    "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n": typeof types.DeleteProjectStatusDocument,
    "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n": typeof types.MoveProjectStatusDocument,
    "\n  mutation UploadAttachment($file: File!) {\n    uploadAttachment(file: $file) {\n      id\n      name\n      url\n      isImage\n    }\n  }\n": typeof types.UploadAttachmentDocument,
};
const documents: Documents = {
    "\n  fragment AlarmFields on Alarm {\n    id\n    title\n    note\n    type\n    startDate\n    time\n    frequency\n    interval\n    weekdays\n    endDate\n    minutes\n    projectId\n    taskId\n    enabled\n    lastFiredAt\n    createdAt\n  }\n": types.AlarmFieldsFragmentDoc,
    "\n  query Alarms {\n    alarms {\n      ...AlarmFields\n    }\n  }\n": types.AlarmsDocument,
    "\n  mutation CreateAlarm($input: AlarmInput!) {\n    createAlarm(input: $input) {\n      id\n    }\n  }\n": types.CreateAlarmDocument,
    "\n  mutation UpdateAlarm($id: ID!, $input: AlarmInput!) {\n    updateAlarm(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateAlarmDocument,
    "\n  mutation DeleteAlarm($id: ID!) {\n    deleteAlarm(id: $id)\n  }\n": types.DeleteAlarmDocument,
    "\n  mutation MarkAlarmFired($id: ID!, $at: DateTime!) {\n    markAlarmFired(id: $id, at: $at)\n  }\n": types.MarkAlarmFiredDocument,
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n    contributorId\n  }\n": types.AccountUserFragmentDoc,
    "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n": types.MeDocument,
    "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n": types.LoginDocument,
    "\n  mutation Logout {\n    logout\n  }\n": types.LogoutDocument,
    "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n": types.RequestPasswordResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n": types.ResetPasswordDocument,
    "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n": types.ConfirmEmailChangeDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n": types.ChangePasswordDocument,
    "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n": types.ChangeUsernameDocument,
    "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n": types.RequestEmailChangeDocument,
    "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n": types.CancelEmailChangeDocument,
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n": types.ContributorFieldsFragmentDoc,
    "\n  fragment MilestoneFields on Milestone {\n    id\n    projectId\n    title\n    description\n    dueDate\n    position\n  }\n": types.MilestoneFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    closed\n  }\n": types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n  }\n": types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": types.CloneTaskDocument,
    "\n  mutation MoveTask($id: ID!, $beforeId: ID, $parentId: ID) {\n    moveTask(id: $id, beforeId: $beforeId, parentId: $parentId)\n  }\n": types.MoveTaskDocument,
    "\n  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": types.AddTaskBlockDocument,
    "\n  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": types.RemoveTaskBlockDocument,
    "\n  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {\n    addTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": types.AddTaskRelationDocument,
    "\n  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {\n    removeTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": types.RemoveTaskRelationDocument,
    "\n  mutation AddTaskComment($taskId: ID!, $body: String!) {\n    addTaskComment(taskId: $taskId, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": types.AddTaskCommentDocument,
    "\n  mutation UpdateTaskComment($id: ID!, $body: String!) {\n    updateTaskComment(id: $id, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": types.UpdateTaskCommentDocument,
    "\n  mutation DeleteTaskComment($id: ID!) {\n    deleteTaskComment(id: $id)\n  }\n": types.DeleteTaskCommentDocument,
    "\n  mutation CreateContributor($input: ContributorInput!) {\n    createContributor(input: $input) {\n      ...ContributorFields\n    }\n  }\n": types.CreateContributorDocument,
    "\n  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {\n    updateContributor(id: $id, input: $input) {\n      ...ContributorFields\n    }\n  }\n": types.UpdateContributorDocument,
    "\n  mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {\n    setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)\n  }\n": types.SetProjectContributorsDocument,
    "\n  mutation DeleteContributor($id: ID!) {\n    deleteContributor(id: $id)\n  }\n": types.DeleteContributorDocument,
    "\n      mutation CreateTaskStatus($input: TaskLabelInput!) {\n        createTaskStatus(input: $input) {\n          id\n        }\n      }\n    ": types.CreateTaskStatusDocument,
    "\n      mutation UpdateTaskStatus($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskStatus(id: $id, input: $input) {\n          id\n        }\n      }\n    ": types.UpdateTaskStatusDocument,
    "\n      mutation DeleteTaskStatus($id: ID!) {\n        deleteTaskStatus(id: $id)\n      }\n    ": types.DeleteTaskStatusDocument,
    "\n      mutation MoveTaskStatus($id: ID!, $index: Int!) {\n        moveTaskStatus(id: $id, index: $index)\n      }\n    ": types.MoveTaskStatusDocument,
    "\n      mutation CreateTaskPriority($input: TaskLabelInput!) {\n        createTaskPriority(input: $input) {\n          id\n        }\n      }\n    ": types.CreateTaskPriorityDocument,
    "\n      mutation UpdateTaskPriority($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskPriority(id: $id, input: $input) {\n          id\n        }\n      }\n    ": types.UpdateTaskPriorityDocument,
    "\n      mutation DeleteTaskPriority($id: ID!) {\n        deleteTaskPriority(id: $id)\n      }\n    ": types.DeleteTaskPriorityDocument,
    "\n      mutation MoveTaskPriority($id: ID!, $index: Int!) {\n        moveTaskPriority(id: $id, index: $index)\n      }\n    ": types.MoveTaskPriorityDocument,
    "\n      mutation CreateTaskType($input: TaskLabelInput!) {\n        createTaskType(input: $input) {\n          id\n        }\n      }\n    ": types.CreateTaskTypeDocument,
    "\n      mutation UpdateTaskType($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskType(id: $id, input: $input) {\n          id\n        }\n      }\n    ": types.UpdateTaskTypeDocument,
    "\n      mutation DeleteTaskType($id: ID!) {\n        deleteTaskType(id: $id)\n      }\n    ": types.DeleteTaskTypeDocument,
    "\n      mutation MoveTaskType($id: ID!, $index: Int!) {\n        moveTaskType(id: $id, index: $index)\n      }\n    ": types.MoveTaskTypeDocument,
    "\n  mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!) {\n    setTasksClosed(ids: $ids, closed: $closed)\n  }\n": types.SetTasksClosedDocument,
    "\n  query TaskViews($projectId: ID) {\n    taskViews(projectId: $projectId) {\n      id\n      name\n      config\n      isDefault\n      position\n    }\n  }\n": types.TaskViewsDocument,
    "\n  query MatchingTaskIds($query: TaskQueryInput!) {\n    matchingTaskIds(query: $query)\n  }\n": types.MatchingTaskIdsDocument,
    "\n  mutation CreateTaskView($input: TaskViewInput!) {\n    createTaskView(input: $input) {\n      id\n    }\n  }\n": types.CreateTaskViewDocument,
    "\n  mutation UpdateTaskView($id: ID!, $input: TaskViewUpdateInput!) {\n    updateTaskView(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateTaskViewDocument,
    "\n  mutation DuplicateTaskView($id: ID!, $name: String!) {\n    duplicateTaskView(id: $id, name: $name) {\n      id\n    }\n  }\n": types.DuplicateTaskViewDocument,
    "\n  mutation DeleteTaskView($id: ID!) {\n    deleteTaskView(id: $id)\n  }\n": types.DeleteTaskViewDocument,
    "\n  mutation SetDefaultTaskView($id: ID!) {\n    setDefaultTaskView(id: $id)\n  }\n": types.SetDefaultTaskViewDocument,
    "\n  mutation MoveTaskView($id: ID!, $index: Int!) {\n    moveTaskView(id: $id, index: $index)\n  }\n": types.MoveTaskViewDocument,
    "\n  mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!) {\n    bulkUpdateTasks(ids: $ids, changes: $changes)\n  }\n": types.BulkUpdateTasksDocument,
    "\n  mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID!) {\n    bulkTransferTasks(ids: $ids, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": types.BulkTransferTasksDocument,
    "\n  mutation BulkSetTasksArchived($ids: [ID!]!, $archived: Boolean!) {\n    bulkSetTasksArchived(ids: $ids, archived: $archived)\n  }\n": types.BulkSetTasksArchivedDocument,
    "\n  mutation BulkDeleteTasks($ids: [ID!]!, $deleteSubtasks: Boolean!) {\n    bulkDeleteTasks(ids: $ids, deleteSubtasks: $deleteSubtasks)\n  }\n": types.BulkDeleteTasksDocument,
    "\n  mutation CreateMilestone($input: MilestoneInput!) {\n    createMilestone(input: $input) {\n      id\n    }\n  }\n": types.CreateMilestoneDocument,
    "\n  mutation UpdateMilestone($id: ID!, $input: MilestoneUpdateInput!) {\n    updateMilestone(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateMilestoneDocument,
    "\n  mutation DeleteMilestone($id: ID!) {\n    deleteMilestone(id: $id)\n  }\n": types.DeleteMilestoneDocument,
    "\n  mutation MoveMilestone($id: ID!, $index: Int!) {\n    moveMilestone(id: $id, index: $index)\n  }\n": types.MoveMilestoneDocument,
    "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n  }\n": types.TimeEntryFieldsFragmentDoc,
    "\n  query TimeEntries($projectId: ID) {\n    timeEntries(projectId: $projectId) {\n      ...TimeEntryFields\n    }\n  }\n": types.TimeEntriesDocument,
    "\n  query RunningTimeEntry {\n    runningTimeEntry {\n      ...TimeEntryFields\n    }\n  }\n": types.RunningTimeEntryDocument,
    "\n  mutation StartTimer($input: TimerInput!) {\n    startTimer(input: $input) {\n      id\n    }\n  }\n": types.StartTimerDocument,
    "\n  mutation SetTimerPaused($paused: Boolean!) {\n    setTimerPaused(paused: $paused) {\n      id\n    }\n  }\n": types.SetTimerPausedDocument,
    "\n  mutation StopTimer {\n    stopTimer {\n      id\n    }\n  }\n": types.StopTimerDocument,
    "\n  mutation CreateTimeEntry($input: TimeEntryInput!) {\n    createTimeEntry(input: $input) {\n      id\n    }\n  }\n": types.CreateTimeEntryDocument,
    "\n  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {\n    updateTimeEntry(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateTimeEntryDocument,
    "\n  mutation DeleteTimeEntry($id: ID!) {\n    deleteTimeEntry(id: $id)\n  }\n": types.DeleteTimeEntryDocument,
    "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n": types.ClientFieldsFragmentDoc,
    "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n": types.LabelFieldsFragmentDoc,
    "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n": types.ProjectStatusFieldsFragmentDoc,
    "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n": types.ProjectFieldsFragmentDoc,
    "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n": types.WorkspaceDocument,
    "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n": types.CreateClientDocument,
    "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n": types.UpdateClientDocument,
    "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n": types.SetClientFavoriteDocument,
    "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n": types.SetClientArchivedDocument,
    "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n": types.DeleteClientDocument,
    "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n": types.MoveClientDocument,
    "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n": types.CreateProjectDocument,
    "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n": types.UpdateProjectDocument,
    "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n": types.SetProjectFavoriteDocument,
    "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n": types.SetProjectArchivedDocument,
    "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n": types.DeleteProjectDocument,
    "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n": types.MoveProjectDocument,
    "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n": types.CreateProjectCategoryDocument,
    "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n": types.UpdateProjectCategoryDocument,
    "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n": types.DeleteProjectCategoryDocument,
    "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": types.CreateProjectStatusDocument,
    "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": types.UpdateProjectStatusDocument,
    "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n": types.DeleteProjectStatusDocument,
    "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n": types.MoveProjectStatusDocument,
    "\n  mutation UploadAttachment($file: File!) {\n    uploadAttachment(file: $file) {\n      id\n      name\n      url\n      isImage\n    }\n  }\n": types.UploadAttachmentDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AlarmFields on Alarm {\n    id\n    title\n    note\n    type\n    startDate\n    time\n    frequency\n    interval\n    weekdays\n    endDate\n    minutes\n    projectId\n    taskId\n    enabled\n    lastFiredAt\n    createdAt\n  }\n"): typeof import('./graphql').AlarmFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Alarms {\n    alarms {\n      ...AlarmFields\n    }\n  }\n"): typeof import('./graphql').AlarmsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateAlarm($input: AlarmInput!) {\n    createAlarm(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateAlarmDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateAlarm($id: ID!, $input: AlarmInput!) {\n    updateAlarm(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateAlarmDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteAlarm($id: ID!) {\n    deleteAlarm(id: $id)\n  }\n"): typeof import('./graphql').DeleteAlarmDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarkAlarmFired($id: ID!, $at: DateTime!) {\n    markAlarmFired(id: $id, at: $at)\n  }\n"): typeof import('./graphql').MarkAlarmFiredDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n    contributorId\n  }\n"): typeof import('./graphql').AccountUserFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').MeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').LoginDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Logout {\n    logout\n  }\n"): typeof import('./graphql').LogoutDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n"): typeof import('./graphql').RequestPasswordResetDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n"): typeof import('./graphql').ResetPasswordDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n"): typeof import('./graphql').ConfirmEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n"): typeof import('./graphql').ChangePasswordDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').ChangeUsernameDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').RequestEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').CancelEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n"): typeof import('./graphql').ContributorFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MilestoneFields on Milestone {\n    id\n    projectId\n    title\n    description\n    dueDate\n    position\n  }\n"): typeof import('./graphql').MilestoneFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n"): typeof import('./graphql').TaskLabelFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    closed\n  }\n"): typeof import('./graphql').TaskFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n"): typeof import('./graphql').TaskCommentFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n  }\n"): typeof import('./graphql').TasksDataDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n"): typeof import('./graphql').TaskCommentsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n"): typeof import('./graphql').CreateTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n"): typeof import('./graphql').UpdateTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n"): typeof import('./graphql').SetTaskArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n"): typeof import('./graphql').DeleteTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n"): typeof import('./graphql').TransferTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n"): typeof import('./graphql').CloneTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveTask($id: ID!, $beforeId: ID, $parentId: ID) {\n    moveTask(id: $id, beforeId: $beforeId, parentId: $parentId)\n  }\n"): typeof import('./graphql').MoveTaskDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n"): typeof import('./graphql').AddTaskBlockDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n"): typeof import('./graphql').RemoveTaskBlockDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {\n    addTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n"): typeof import('./graphql').AddTaskRelationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {\n    removeTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n"): typeof import('./graphql').RemoveTaskRelationDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTaskComment($taskId: ID!, $body: String!) {\n    addTaskComment(taskId: $taskId, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n"): typeof import('./graphql').AddTaskCommentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTaskComment($id: ID!, $body: String!) {\n    updateTaskComment(id: $id, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n"): typeof import('./graphql').UpdateTaskCommentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTaskComment($id: ID!) {\n    deleteTaskComment(id: $id)\n  }\n"): typeof import('./graphql').DeleteTaskCommentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateContributor($input: ContributorInput!) {\n    createContributor(input: $input) {\n      ...ContributorFields\n    }\n  }\n"): typeof import('./graphql').CreateContributorDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {\n    updateContributor(id: $id, input: $input) {\n      ...ContributorFields\n    }\n  }\n"): typeof import('./graphql').UpdateContributorDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {\n    setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)\n  }\n"): typeof import('./graphql').SetProjectContributorsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteContributor($id: ID!) {\n    deleteContributor(id: $id)\n  }\n"): typeof import('./graphql').DeleteContributorDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation CreateTaskStatus($input: TaskLabelInput!) {\n        createTaskStatus(input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').CreateTaskStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation UpdateTaskStatus($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskStatus(id: $id, input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').UpdateTaskStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation DeleteTaskStatus($id: ID!) {\n        deleteTaskStatus(id: $id)\n      }\n    "): typeof import('./graphql').DeleteTaskStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation MoveTaskStatus($id: ID!, $index: Int!) {\n        moveTaskStatus(id: $id, index: $index)\n      }\n    "): typeof import('./graphql').MoveTaskStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation CreateTaskPriority($input: TaskLabelInput!) {\n        createTaskPriority(input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').CreateTaskPriorityDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation UpdateTaskPriority($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskPriority(id: $id, input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').UpdateTaskPriorityDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation DeleteTaskPriority($id: ID!) {\n        deleteTaskPriority(id: $id)\n      }\n    "): typeof import('./graphql').DeleteTaskPriorityDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation MoveTaskPriority($id: ID!, $index: Int!) {\n        moveTaskPriority(id: $id, index: $index)\n      }\n    "): typeof import('./graphql').MoveTaskPriorityDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation CreateTaskType($input: TaskLabelInput!) {\n        createTaskType(input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').CreateTaskTypeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation UpdateTaskType($id: ID!, $input: TaskLabelUpdateInput!) {\n        updateTaskType(id: $id, input: $input) {\n          id\n        }\n      }\n    "): typeof import('./graphql').UpdateTaskTypeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation DeleteTaskType($id: ID!) {\n        deleteTaskType(id: $id)\n      }\n    "): typeof import('./graphql').DeleteTaskTypeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n      mutation MoveTaskType($id: ID!, $index: Int!) {\n        moveTaskType(id: $id, index: $index)\n      }\n    "): typeof import('./graphql').MoveTaskTypeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!) {\n    setTasksClosed(ids: $ids, closed: $closed)\n  }\n"): typeof import('./graphql').SetTasksClosedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TaskViews($projectId: ID) {\n    taskViews(projectId: $projectId) {\n      id\n      name\n      config\n      isDefault\n      position\n    }\n  }\n"): typeof import('./graphql').TaskViewsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MatchingTaskIds($query: TaskQueryInput!) {\n    matchingTaskIds(query: $query)\n  }\n"): typeof import('./graphql').MatchingTaskIdsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTaskView($input: TaskViewInput!) {\n    createTaskView(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTaskView($id: ID!, $input: TaskViewUpdateInput!) {\n    updateTaskView(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DuplicateTaskView($id: ID!, $name: String!) {\n    duplicateTaskView(id: $id, name: $name) {\n      id\n    }\n  }\n"): typeof import('./graphql').DuplicateTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTaskView($id: ID!) {\n    deleteTaskView(id: $id)\n  }\n"): typeof import('./graphql').DeleteTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetDefaultTaskView($id: ID!) {\n    setDefaultTaskView(id: $id)\n  }\n"): typeof import('./graphql').SetDefaultTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveTaskView($id: ID!, $index: Int!) {\n    moveTaskView(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveTaskViewDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!) {\n    bulkUpdateTasks(ids: $ids, changes: $changes)\n  }\n"): typeof import('./graphql').BulkUpdateTasksDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID!) {\n    bulkTransferTasks(ids: $ids, projectId: $projectId) {\n      removedLinks\n    }\n  }\n"): typeof import('./graphql').BulkTransferTasksDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation BulkSetTasksArchived($ids: [ID!]!, $archived: Boolean!) {\n    bulkSetTasksArchived(ids: $ids, archived: $archived)\n  }\n"): typeof import('./graphql').BulkSetTasksArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation BulkDeleteTasks($ids: [ID!]!, $deleteSubtasks: Boolean!) {\n    bulkDeleteTasks(ids: $ids, deleteSubtasks: $deleteSubtasks)\n  }\n"): typeof import('./graphql').BulkDeleteTasksDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateMilestone($input: MilestoneInput!) {\n    createMilestone(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateMilestoneDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateMilestone($id: ID!, $input: MilestoneUpdateInput!) {\n    updateMilestone(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateMilestoneDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteMilestone($id: ID!) {\n    deleteMilestone(id: $id)\n  }\n"): typeof import('./graphql').DeleteMilestoneDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveMilestone($id: ID!, $index: Int!) {\n    moveMilestone(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveMilestoneDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n  }\n"): typeof import('./graphql').TimeEntryFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TimeEntries($projectId: ID) {\n    timeEntries(projectId: $projectId) {\n      ...TimeEntryFields\n    }\n  }\n"): typeof import('./graphql').TimeEntriesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RunningTimeEntry {\n    runningTimeEntry {\n      ...TimeEntryFields\n    }\n  }\n"): typeof import('./graphql').RunningTimeEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartTimer($input: TimerInput!) {\n    startTimer(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').StartTimerDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetTimerPaused($paused: Boolean!) {\n    setTimerPaused(paused: $paused) {\n      id\n    }\n  }\n"): typeof import('./graphql').SetTimerPausedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StopTimer {\n    stopTimer {\n      id\n    }\n  }\n"): typeof import('./graphql').StopTimerDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTimeEntry($input: TimeEntryInput!) {\n    createTimeEntry(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateTimeEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {\n    updateTimeEntry(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateTimeEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTimeEntry($id: ID!) {\n    deleteTimeEntry(id: $id)\n  }\n"): typeof import('./graphql').DeleteTimeEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n"): typeof import('./graphql').ClientFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n"): typeof import('./graphql').LabelFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n"): typeof import('./graphql').ProjectStatusFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').ProjectFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').WorkspaceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').CreateClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').UpdateClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').SetClientFavoriteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').SetClientArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n"): typeof import('./graphql').DeleteClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').SetProjectFavoriteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').SetProjectArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n"): typeof import('./graphql').MoveProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UploadAttachment($file: File!) {\n    uploadAttachment(file: $file) {\n      id\n      name\n      url\n      isImage\n    }\n  }\n"): typeof import('./graphql').UploadAttachmentDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
