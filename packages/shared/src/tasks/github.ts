/** Settings of the link of a project with a GitHub board: the fields synced, their options, what is pushed. */
export interface GithubLinkInput {
  url: string;
  statusFieldId: string | null;
  priorityFieldId: string | null;
  iterationFieldId: string | null;
  startFieldId: string | null;
  endFieldId: string | null;
  effortFieldId: string | null;
  deadlineFieldId: string | null;
  timeSpentFieldId: string | null;
  /** FIELD (typeFieldId), ISSUE_TYPE (issue types of the organization) or null. */
  typeSource: 'FIELD' | 'ISSUE_TYPE' | null;
  typeFieldId: string | null;
  /** { [ordoStatusId]: optionId } */
  statusOptions: Record<string, string>;
  priorityOptions: Record<string, string>;
  /** { [ordoTypeId]: optionId or issue type id } */
  typeOptions: Record<string, string>;
  syncAssignees: boolean;
  syncLabels: boolean;
  /** "owner/name", or null for draft issues. */
  repositoryName: string | null;
  pushExisting: boolean;
  enabled: boolean;
}
