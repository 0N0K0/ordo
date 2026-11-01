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
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n": typeof types.AccountUserFragmentDoc,
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
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n  }\n": typeof types.ContributorFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": typeof types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n  }\n": typeof types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": typeof types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n  }\n": typeof types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": typeof types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": typeof types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": typeof types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": typeof types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": typeof types.CloneTaskDocument,
    "\n  mutation MoveTask($id: ID!, $beforeId: ID) {\n    moveTask(id: $id, beforeId: $beforeId)\n  }\n": typeof types.MoveTaskDocument,
    "\n  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": typeof types.AddTaskBlockDocument,
    "\n  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": typeof types.RemoveTaskBlockDocument,
    "\n  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {\n    addTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": typeof types.AddTaskRelationDocument,
    "\n  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {\n    removeTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": typeof types.RemoveTaskRelationDocument,
    "\n  mutation AddTaskComment($taskId: ID!, $body: String!) {\n    addTaskComment(taskId: $taskId, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": typeof types.AddTaskCommentDocument,
    "\n  mutation UpdateTaskComment($id: ID!, $body: String!) {\n    updateTaskComment(id: $id, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": typeof types.UpdateTaskCommentDocument,
    "\n  mutation DeleteTaskComment($id: ID!) {\n    deleteTaskComment(id: $id)\n  }\n": typeof types.DeleteTaskCommentDocument,
    "\n  mutation CreateContributor($input: ContributorInput!) {\n    createContributor(input: $input) {\n      ...ContributorFields\n    }\n  }\n": typeof types.CreateContributorDocument,
    "\n  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {\n    updateContributor(id: $id, input: $input) {\n      ...ContributorFields\n    }\n  }\n": typeof types.UpdateContributorDocument,
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
};
const documents: Documents = {
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n": types.AccountUserFragmentDoc,
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
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n  }\n": types.ContributorFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n  }\n": types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n  }\n": types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": types.CloneTaskDocument,
    "\n  mutation MoveTask($id: ID!, $beforeId: ID) {\n    moveTask(id: $id, beforeId: $beforeId)\n  }\n": types.MoveTaskDocument,
    "\n  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": types.AddTaskBlockDocument,
    "\n  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {\n    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)\n  }\n": types.RemoveTaskBlockDocument,
    "\n  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {\n    addTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": types.AddTaskRelationDocument,
    "\n  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {\n    removeTaskRelation(taskId: $taskId, otherId: $otherId)\n  }\n": types.RemoveTaskRelationDocument,
    "\n  mutation AddTaskComment($taskId: ID!, $body: String!) {\n    addTaskComment(taskId: $taskId, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": types.AddTaskCommentDocument,
    "\n  mutation UpdateTaskComment($id: ID!, $body: String!) {\n    updateTaskComment(id: $id, body: $body) {\n      ...TaskCommentFields\n    }\n  }\n": types.UpdateTaskCommentDocument,
    "\n  mutation DeleteTaskComment($id: ID!) {\n    deleteTaskComment(id: $id)\n  }\n": types.DeleteTaskCommentDocument,
    "\n  mutation CreateContributor($input: ContributorInput!) {\n    createContributor(input: $input) {\n      ...ContributorFields\n    }\n  }\n": types.CreateContributorDocument,
    "\n  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {\n    updateContributor(id: $id, input: $input) {\n      ...ContributorFields\n    }\n  }\n": types.UpdateContributorDocument,
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
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n"): typeof import('./graphql').AccountUserFragmentDoc;
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
export function graphql(source: "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n  }\n"): typeof import('./graphql').ContributorFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n"): typeof import('./graphql').TaskLabelFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n  }\n"): typeof import('./graphql').TaskFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n"): typeof import('./graphql').TaskCommentFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n  }\n"): typeof import('./graphql').TasksDataDocument;
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
export function graphql(source: "\n  mutation MoveTask($id: ID!, $beforeId: ID) {\n    moveTask(id: $id, beforeId: $beforeId)\n  }\n"): typeof import('./graphql').MoveTaskDocument;
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


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
