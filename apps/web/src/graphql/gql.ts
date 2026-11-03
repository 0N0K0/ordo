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
    "\n  fragment CompanyProfileFields on CompanyProfile {\n    name\n    legalForm\n    capital\n    registration\n    siren\n    siret\n    activityCode\n    vatNumber\n    vatApplicable\n    vatExemptionText\n    address\n    email\n    phone\n    website\n    logoUrl\n    bankName\n    accountHolder\n    iban\n    bic\n    paymentTerms\n    paymentDays\n    paymentMethods\n    lateInterest\n    otherMentions\n    referenceLabel\n    quoteValidityDays\n  }\n": typeof types.CompanyProfileFieldsFragmentDoc,
    "\n  query CompanyProfile {\n    companyProfile {\n      ...CompanyProfileFields\n    }\n  }\n": typeof types.CompanyProfileDocument,
    "\n  query DocumentSequences($year: Int!) {\n    documentSequences(year: $year) {\n      type\n      year\n      nextNumber\n      minimum\n    }\n  }\n": typeof types.DocumentSequencesDocument,
    "\n  query ClientBilling($id: ID!) {\n    client(id: $id) {\n      id\n      name\n      kind\n      firstName\n      lastName\n      address\n      email\n      phones\n      website\n      vatNumber\n      siren\n      siret\n      activityCode\n      services {\n        id\n        name\n        address\n        email\n        phones\n      }\n      contacts {\n        id\n        serviceId\n        firstName\n        lastName\n        email\n        jobTitle\n        phones\n      }\n    }\n  }\n": typeof types.ClientBillingDocument,
    "\n  mutation UpdateCompanyProfile($input: CompanyProfileInput!) {\n    updateCompanyProfile(input: $input) {\n      name\n    }\n  }\n": typeof types.UpdateCompanyProfileDocument,
    "\n  mutation SetCompanyLogo($file: File) {\n    setCompanyLogo(file: $file) {\n      logoUrl\n    }\n  }\n": typeof types.SetCompanyLogoDocument,
    "\n  mutation SetDocumentSequence($type: AccountingDocumentType!, $year: Int!, $nextNumber: Int!) {\n    setDocumentSequence(type: $type, year: $year, nextNumber: $nextNumber)\n  }\n": typeof types.SetDocumentSequenceDocument,
    "\n  mutation UpdateClientDetails($id: ID!, $input: ClientDetailsInput!) {\n    updateClientDetails(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateClientDetailsDocument,
    "\n  mutation CreateClientService($clientId: ID!, $input: ClientServiceInput!) {\n    createClientService(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n": typeof types.CreateClientServiceDocument,
    "\n  mutation UpdateClientService($id: ID!, $input: ClientServiceInput!) {\n    updateClientService(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateClientServiceDocument,
    "\n  mutation DeleteClientService($id: ID!) {\n    deleteClientService(id: $id)\n  }\n": typeof types.DeleteClientServiceDocument,
    "\n  mutation CreateClientContact($clientId: ID!, $input: ClientContactInput!) {\n    createClientContact(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n": typeof types.CreateClientContactDocument,
    "\n  mutation UpdateClientContact($id: ID!, $input: ClientContactInput!) {\n    updateClientContact(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateClientContactDocument,
    "\n  mutation DeleteClientContact($id: ID!) {\n    deleteClientContact(id: $id)\n  }\n": typeof types.DeleteClientContactDocument,
    "\n  query CatalogItems {\n    catalogItems {\n      id\n      kind\n      title\n      description\n      unit\n      unitPrice\n      vatRate\n      archived\n    }\n  }\n": typeof types.CatalogItemsDocument,
    "\n  mutation CreateCatalogItem($input: CatalogItemInput!) {\n    createCatalogItem(input: $input)\n  }\n": typeof types.CreateCatalogItemDocument,
    "\n  mutation UpdateCatalogItem($id: ID!, $input: CatalogItemInput!) {\n    updateCatalogItem(id: $id, input: $input)\n  }\n": typeof types.UpdateCatalogItemDocument,
    "\n  mutation DeleteCatalogItem($id: ID!) {\n    deleteCatalogItem(id: $id)\n  }\n": typeof types.DeleteCatalogItemDocument,
    "\n  fragment AccountingDocumentListFields on AccountingDocument {\n    id\n    type\n    status\n    number\n    issueDate\n    dueDate\n    clientId\n    clientName\n    projectId\n    title\n    totalNet\n    totalGross\n    currency\n    invoicedNet\n    sourceNumber\n    recurringId\n    trackingStatus {\n      id\n      name\n      color\n      category\n    }\n    balance\n    overdue\n  }\n": typeof types.AccountingDocumentListFieldsFragmentDoc,
    "\n  fragment AccountingDocumentFields on AccountingDocument {\n    ...AccountingDocumentListFields\n    serviceStart\n    serviceEnd\n    serviceId\n    contactId\n    sourceId\n    derived {\n      id\n      type\n      status\n      number\n      totalGross\n    }\n    seller\n    buyer\n    introduction\n    referenceLabel\n    referenceValue\n    conclusion\n    paymentTerms\n    paymentMethods\n    lateInterest\n    depositType\n    depositValue\n    billingSchedule\n    otherMentions\n    timeEntries {\n      id\n      projectId\n      description\n      startedAt\n      duration\n    }\n    showBankDetails\n    vatApplicable\n    vatExemptionText\n    globalDiscountType\n    globalDiscountValue\n    totalVat\n    finalizedAt\n    updatedAt\n    sentAt\n    acceptedAt\n    signedFileUrl\n    signedFileName\n    paid\n    credited\n    reminders {\n      id\n      date\n      note\n    }\n    payments {\n      id\n      amount\n      entry {\n        id\n        date\n        accountName\n        method\n      }\n    }\n    lines {\n      id\n      kind\n      title\n      description\n      quantity\n      unit\n      unitPrice\n      vatRate\n      discountType\n      discountValue\n    }\n    attachments {\n      id\n      name\n      size\n      url\n    }\n  }\n": typeof types.AccountingDocumentFieldsFragmentDoc,
    "\n  query AccountingDocuments($clientId: ID, $projectId: ID) {\n    accountingDocuments(clientId: $clientId, projectId: $projectId) {\n      ...AccountingDocumentListFields\n    }\n  }\n": typeof types.AccountingDocumentsDocument,
    "\n  query AccountingDocument($id: ID!) {\n    accountingDocument(id: $id) {\n      ...AccountingDocumentFields\n    }\n  }\n": typeof types.AccountingDocumentDocument,
    "\n  query NewDocumentDefaults($type: AccountingDocumentType!, $clientId: ID!, $issueDate: Date!) {\n    newDocumentDefaults(type: $type, clientId: $clientId, issueDate: $issueDate)\n  }\n": typeof types.NewDocumentDefaultsDocument,
    "\n  query RecurringInvoices {\n    recurringInvoices {\n      id\n      name\n      templateId\n      recurrence\n      startDate\n      nextDate\n      autoFinalize\n      active\n      issuedCount\n      template {\n        clientName\n        totalGross\n        currency\n      }\n    }\n  }\n": typeof types.RecurringInvoicesDocument,
    "\n  query ProjectResources($projectId: ID!) {\n    projectResources(projectId: $projectId) {\n      id\n      kind\n      title\n      note\n      url\n      size\n      createdAt\n    }\n  }\n": typeof types.ProjectResourcesDocument,
    "\n  mutation CreateAccountingDocument($type: AccountingDocumentType!, $input: AccountingDocumentInput!) {\n    createAccountingDocument(type: $type, input: $input)\n  }\n": typeof types.CreateAccountingDocumentDocument,
    "\n  mutation UpdateAccountingDocument($id: ID!, $input: AccountingDocumentInput!) {\n    updateAccountingDocument(id: $id, input: $input)\n  }\n": typeof types.UpdateAccountingDocumentDocument,
    "\n  mutation DeleteAccountingDocument($id: ID!) {\n    deleteAccountingDocument(id: $id)\n  }\n": typeof types.DeleteAccountingDocumentDocument,
    "\n  mutation FinalizeAccountingDocument($id: ID!) {\n    finalizeAccountingDocument(id: $id)\n  }\n": typeof types.FinalizeAccountingDocumentDocument,
    "\n  mutation CreateDocumentFrom($sourceId: ID!, $type: AccountingDocumentType!, $depositPercent: Float, $issueDate: Date!) {\n    createDocumentFrom(sourceId: $sourceId, type: $type, depositPercent: $depositPercent, issueDate: $issueDate)\n  }\n": typeof types.CreateDocumentFromDocument,
    "\n  mutation DuplicateAccountingDocument($id: ID!, $issueDate: Date!) {\n    duplicateAccountingDocument(id: $id, issueDate: $issueDate)\n  }\n": typeof types.DuplicateAccountingDocumentDocument,
    "\n  mutation AddAccountingAttachments($id: ID!, $files: [File!]!) {\n    addAccountingAttachments(id: $id, files: $files)\n  }\n": typeof types.AddAccountingAttachmentsDocument,
    "\n  mutation RemoveAccountingAttachment($attachmentId: ID!) {\n    removeAccountingAttachment(attachmentId: $attachmentId)\n  }\n": typeof types.RemoveAccountingAttachmentDocument,
    "\n  mutation CreateRecurringInvoice($documentId: ID!, $input: RecurringInvoiceInput!) {\n    createRecurringInvoice(documentId: $documentId, input: $input)\n  }\n": typeof types.CreateRecurringInvoiceDocument,
    "\n  mutation UpdateRecurringInvoice($id: ID!, $input: RecurringInvoiceInput!) {\n    updateRecurringInvoice(id: $id, input: $input)\n  }\n": typeof types.UpdateRecurringInvoiceDocument,
    "\n  mutation DeleteRecurringInvoice($id: ID!) {\n    deleteRecurringInvoice(id: $id)\n  }\n": typeof types.DeleteRecurringInvoiceDocument,
    "\n  mutation AddProjectLink($projectId: ID!, $title: String!, $url: String!, $note: String) {\n    addProjectLink(projectId: $projectId, title: $title, url: $url, note: $note)\n  }\n": typeof types.AddProjectLinkDocument,
    "\n  mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {\n    addProjectFiles(projectId: $projectId, files: $files)\n  }\n": typeof types.AddProjectFilesDocument,
    "\n  mutation UpdateProjectResource($id: ID!, $title: String!, $url: String, $note: String) {\n    updateProjectResource(id: $id, title: $title, url: $url, note: $note)\n  }\n": typeof types.UpdateProjectResourceDocument,
    "\n  mutation DeleteProjectResource($id: ID!) {\n    deleteProjectResource(id: $id)\n  }\n": typeof types.DeleteProjectResourceDocument,
    "\n  mutation MoveProjectResource($id: ID!, $index: Int!) {\n    moveProjectResource(id: $id, index: $index)\n  }\n": typeof types.MoveProjectResourceDocument,
    "\n  query ImportedDocuments($clientId: ID, $projectId: ID) {\n    importedDocuments(clientId: $clientId, projectId: $projectId) {\n      id\n      type\n      number\n      issueDate\n      dueDate\n      clientId\n      clientName\n      projectId\n      title\n      totalNet\n      totalVat\n      totalGross\n      currency\n      note\n      fileUrl\n      fileName\n      settled\n      paid\n      balance\n    }\n  }\n": typeof types.ImportedDocumentsDocument,
    "\n  mutation ImportDocument($input: ImportedDocumentInput!, $file: File) {\n    importDocument(input: $input, file: $file)\n  }\n": typeof types.ImportDocumentDocument,
    "\n  mutation UpdateImportedDocument($id: ID!, $input: ImportedDocumentInput!, $file: File) {\n    updateImportedDocument(id: $id, input: $input, file: $file)\n  }\n": typeof types.UpdateImportedDocumentDocument,
    "\n  mutation DeleteImportedDocument($id: ID!) {\n    deleteImportedDocument(id: $id)\n  }\n": typeof types.DeleteImportedDocumentDocument,
    "\n  query DocumentStatuses {\n    documentStatuses {\n      id\n      scope\n      name\n      color\n      category\n      position\n      documentCount\n    }\n  }\n": typeof types.DocumentStatusesDocument,
    "\n  query OverdueInvoices($today: Date!) {\n    overdueInvoices(today: $today) {\n      id\n      type\n      number\n      clientId\n      clientName\n      projectId\n      contactId\n      serviceId\n      issueDate\n      dueDate\n      totalGross\n      currency\n      balance\n      billingEmail\n      reminderCount\n      lastReminderAt\n    }\n  }\n": typeof types.OverdueInvoicesDocument,
    "\n  mutation SendDocumentReminders($accountId: ID!, $documentIds: [ID!]!) {\n    sendDocumentReminders(accountId: $accountId, documentIds: $documentIds) {\n      documentId\n      number\n      error\n    }\n  }\n": typeof types.SendDocumentRemindersDocument,
    "\n  mutation CreateDocumentStatus($scope: DocumentStatusScope!, $name: String!, $color: String!, $category: DocumentStatusCategory!) {\n    createDocumentStatus(scope: $scope, name: $name, color: $color, category: $category)\n  }\n": typeof types.CreateDocumentStatusDocument,
    "\n  mutation UpdateDocumentStatus($id: ID!, $name: String, $color: String, $category: DocumentStatusCategory) {\n    updateDocumentStatus(id: $id, name: $name, color: $color, category: $category)\n  }\n": typeof types.UpdateDocumentStatusDocument,
    "\n  mutation DeleteDocumentStatus($id: ID!) {\n    deleteDocumentStatus(id: $id)\n  }\n": typeof types.DeleteDocumentStatusDocument,
    "\n  mutation MoveDocumentStatus($id: ID!, $index: Int!) {\n    moveDocumentStatus(id: $id, index: $index)\n  }\n": typeof types.MoveDocumentStatusDocument,
    "\n  mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {\n    setDocumentTrackingStatus(id: $id, statusId: $statusId)\n  }\n": typeof types.SetDocumentTrackingStatusDocument,
    "\n  mutation MarkDocumentSent($id: ID!) {\n    markDocumentSent(id: $id)\n  }\n": typeof types.MarkDocumentSentDocument,
    "\n  mutation AcceptQuote($id: ID!, $date: Date!, $file: File) {\n    acceptQuote(id: $id, date: $date, file: $file)\n  }\n": typeof types.AcceptQuoteDocument,
    "\n  mutation RemoveSignedQuote($id: ID!) {\n    removeSignedQuote(id: $id)\n  }\n": typeof types.RemoveSignedQuoteDocument,
    "\n  mutation AddDocumentReminder($id: ID!, $note: String) {\n    addDocumentReminder(id: $id, note: $note)\n  }\n": typeof types.AddDocumentReminderDocument,
    "\n  mutation DeleteDocumentReminder($id: ID!) {\n    deleteDocumentReminder(id: $id)\n  }\n": typeof types.DeleteDocumentReminderDocument,
    "\n  mutation RecordDocumentPayment($id: ID!, $input: DocumentPaymentInput!) {\n    recordDocumentPayment(id: $id, input: $input)\n  }\n": typeof types.RecordDocumentPaymentDocument,
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
    "\n  fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {\n    key\n    eventId\n    occurrenceDate\n    modified\n    title\n    description\n    location\n    links {\n      url\n      label\n    }\n    allDay\n    startDate\n    startTime\n    endDate\n    endTime\n    timeZone\n    start\n    end\n    recurrence\n    seriesStartDate\n    reminders\n    projectId\n    contributorIds\n    categoryIds\n  }\n": typeof types.CalendarEventOccurrenceFieldsFragmentDoc,
    "\n  query CalendarCategories {\n    calendarCategories {\n      id\n      name\n      color\n      parentId\n      position\n    }\n  }\n": typeof types.CalendarCategoriesDocument,
    "\n  query CalendarEvents($from: Date!, $to: Date!) {\n    calendarEvents(from: $from, to: $to) {\n      ...CalendarEventOccurrenceFields\n    }\n  }\n": typeof types.CalendarEventsDocument,
    "\n  mutation CreateCalendarCategory($input: CalendarCategoryInput!) {\n    createCalendarCategory(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateCalendarCategoryDocument,
    "\n  mutation UpdateCalendarCategory($id: ID!, $input: CalendarCategoryInput!) {\n    updateCalendarCategory(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateCalendarCategoryDocument,
    "\n  mutation DeleteCalendarCategory($id: ID!) {\n    deleteCalendarCategory(id: $id)\n  }\n": typeof types.DeleteCalendarCategoryDocument,
    "\n  mutation MoveCalendarCategory($id: ID!, $index: Int!) {\n    moveCalendarCategory(id: $id, index: $index)\n  }\n": typeof types.MoveCalendarCategoryDocument,
    "\n  mutation CreateCalendarEvent($input: CalendarEventInput!) {\n    createCalendarEvent(input: $input)\n  }\n": typeof types.CreateCalendarEventDocument,
    "\n  mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    updateCalendarEvent(id: $id, input: $input, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n": typeof types.UpdateCalendarEventDocument,
    "\n  mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n": typeof types.DeleteCalendarEventDocument,
    "\n  mutation MaterializeTaskOccurrences($from: Date!, $to: Date!) {\n    materializeTaskOccurrences(from: $from, to: $to)\n  }\n": typeof types.MaterializeTaskOccurrencesDocument,
    "\n  query Dashboards($projectId: ID) {\n    dashboards(projectId: $projectId) {\n      id\n      projectId\n      name\n      position\n      charts {\n        id\n        dashboardId\n        title\n        config\n        wide\n        position\n      }\n    }\n  }\n": typeof types.DashboardsDocument,
    "\n  mutation CreateDashboard($name: String!, $projectId: ID) {\n    createDashboard(name: $name, projectId: $projectId)\n  }\n": typeof types.CreateDashboardDocument,
    "\n  mutation RenameDashboard($id: ID!, $name: String!) {\n    renameDashboard(id: $id, name: $name)\n  }\n": typeof types.RenameDashboardDocument,
    "\n  mutation DeleteDashboard($id: ID!) {\n    deleteDashboard(id: $id)\n  }\n": typeof types.DeleteDashboardDocument,
    "\n  mutation MoveDashboard($id: ID!, $index: Int!) {\n    moveDashboard(id: $id, index: $index)\n  }\n": typeof types.MoveDashboardDocument,
    "\n  mutation CreateDashboardChart($dashboardId: ID!, $input: DashboardChartInput!) {\n    createDashboardChart(dashboardId: $dashboardId, input: $input)\n  }\n": typeof types.CreateDashboardChartDocument,
    "\n  mutation UpdateDashboardChart($id: ID!, $input: DashboardChartInput!) {\n    updateDashboardChart(id: $id, input: $input)\n  }\n": typeof types.UpdateDashboardChartDocument,
    "\n  mutation DuplicateDashboardChart($id: ID!) {\n    duplicateDashboardChart(id: $id)\n  }\n": typeof types.DuplicateDashboardChartDocument,
    "\n  mutation DeleteDashboardChart($id: ID!) {\n    deleteDashboardChart(id: $id)\n  }\n": typeof types.DeleteDashboardChartDocument,
    "\n  mutation MoveDashboardChart($id: ID!, $index: Int!) {\n    moveDashboardChart(id: $id, index: $index)\n  }\n": typeof types.MoveDashboardChartDocument,
    "\n  query GithubLogin {\n    githubLogin\n  }\n": typeof types.GithubLoginDocument,
    "\n  query GithubContributors {\n    githubContributors {\n      id\n      name\n      githubLogin\n    }\n  }\n": typeof types.GithubContributorsDocument,
    "\n  query GithubBoard($url: String!) {\n    githubBoard(url: $url) {\n      id\n      title\n      url\n      fields {\n        id\n        name\n        dataType\n        iterationCount\n        options {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.GithubBoardDocument,
    "\n  query GithubProjectLink($projectId: ID!) {\n    githubProjectLink(projectId: $projectId) {\n      id\n      projectId\n      url\n      title\n      statusFieldId\n      priorityFieldId\n      iterationFieldId\n      startFieldId\n      endFieldId\n      effortFieldId\n      statusOptions\n      priorityOptions\n      repositoryName\n      pushExisting\n      enabled\n      lastSyncAt\n      lastSyncError\n      lastSyncSummary\n      linkedTaskCount\n    }\n  }\n": typeof types.GithubProjectLinkDocument,
    "\n  mutation SetGithubToken($token: String!) {\n    setGithubToken(token: $token)\n  }\n": typeof types.SetGithubTokenDocument,
    "\n  mutation RemoveGithubToken {\n    removeGithubToken\n  }\n": typeof types.RemoveGithubTokenDocument,
    "\n  mutation SaveGithubLink($projectId: ID!, $input: GithubLinkInput!) {\n    saveGithubLink(projectId: $projectId, input: $input)\n  }\n": typeof types.SaveGithubLinkDocument,
    "\n  mutation UnlinkGithubProject($projectId: ID!) {\n    unlinkGithubProject(projectId: $projectId)\n  }\n": typeof types.UnlinkGithubProjectDocument,
    "\n  mutation SyncGithubProject($projectId: ID!) {\n    syncGithubProject(projectId: $projectId) {\n      pulledNew\n      pushedNew\n      pulled\n      pushed\n      unlinked\n      sprints\n    }\n  }\n": typeof types.SyncGithubProjectDocument,
    "\n  mutation SetContributorGithubLogin($id: ID!, $login: String) {\n    setContributorGithubLogin(id: $id, login: $login)\n  }\n": typeof types.SetContributorGithubLoginDocument,
    "\n  fragment MailAccountFields on MailAccount {\n    id\n    name\n    email\n    displayName\n    imapHost\n    imapPort\n    imapSecure\n    imapUser\n    smtpHost\n    smtpPort\n    smtpSecure\n    smtpUser\n    saveSent\n    signature\n  }\n": typeof types.MailAccountFieldsFragmentDoc,
    "\n  fragment MailViewFields on MailView {\n    accountId\n    folder\n    uid\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    replyTo {\n      name\n      address\n    }\n    date\n    html\n    text\n    attachments {\n      index\n      filename\n      contentType\n      size\n      inline\n    }\n    linkedProjectIds\n  }\n": typeof types.MailViewFieldsFragmentDoc,
    "\n  fragment LinkedMailFields on LinkedMail {\n    id\n    projectId\n    accountId\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    date\n    html\n    text\n    sent\n    attachments {\n      id\n      name\n      size\n      inline\n      url\n    }\n  }\n": typeof types.LinkedMailFieldsFragmentDoc,
    "\n  query MailAccounts {\n    mailAccounts {\n      ...MailAccountFields\n    }\n  }\n": typeof types.MailAccountsDocument,
    "\n  query MailFolders($accountId: ID!) {\n    mailFolders(accountId: $accountId) {\n      path\n      name\n      specialUse\n      unseen\n      depth\n    }\n  }\n": typeof types.MailFoldersDocument,
    "\n  query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String) {\n    mailMessages(accountId: $accountId, folder: $folder, page: $page, search: $search) {\n      total\n      pageSize\n      messages {\n        uid\n        subject\n        from {\n          name\n          address\n        }\n        to {\n          name\n          address\n        }\n        date\n        seen\n        flagged\n        hasAttachments\n      }\n    }\n  }\n": typeof types.MailMessagesDocument,
    "\n  query MailMessage($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailMessage(accountId: $accountId, folder: $folder, uid: $uid) {\n      ...MailViewFields\n    }\n  }\n": typeof types.MailMessageDocument,
    "\n  query UnreadMailCount {\n    unreadMailCount\n  }\n": typeof types.UnreadMailCountDocument,
    "\n  query ProjectMails($projectId: ID!) {\n    projectMails(projectId: $projectId) {\n      ...LinkedMailFields\n    }\n  }\n": typeof types.ProjectMailsDocument,
    "\n  mutation TestMailAccount($input: MailAccountInput!, $id: ID) {\n    testMailAccount(input: $input, id: $id)\n  }\n": typeof types.TestMailAccountDocument,
    "\n  mutation CreateMailAccount($input: MailAccountInput!) {\n    createMailAccount(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateMailAccountDocument,
    "\n  mutation UpdateMailAccount($id: ID!, $input: MailAccountInput!) {\n    updateMailAccount(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateMailAccountDocument,
    "\n  mutation SetMailSignature($id: ID!, $signature: String!) {\n    setMailSignature(id: $id, signature: $signature) {\n      id\n    }\n  }\n": typeof types.SetMailSignatureDocument,
    "\n  mutation DeleteMailAccount($id: ID!) {\n    deleteMailAccount(id: $id)\n  }\n": typeof types.DeleteMailAccountDocument,
    "\n  mutation MoveMailAccount($id: ID!, $index: Int!) {\n    moveMailAccount(id: $id, index: $index)\n  }\n": typeof types.MoveMailAccountDocument,
    "\n  mutation SetMailSeen($accountId: ID!, $folder: String!, $uids: [Int!]!, $seen: Boolean!) {\n    setMailSeen(accountId: $accountId, folder: $folder, uids: $uids, seen: $seen)\n  }\n": typeof types.SetMailSeenDocument,
    "\n  mutation DeleteMails($accountId: ID!, $folder: String!, $uids: [Int!]!) {\n    deleteMails(accountId: $accountId, folder: $folder, uids: $uids)\n  }\n": typeof types.DeleteMailsDocument,
    "\n  mutation LinkMail($accountId: ID!, $folder: String!, $uid: Int!, $projectId: ID!) {\n    linkMail(accountId: $accountId, folder: $folder, uid: $uid, projectId: $projectId) {\n      id\n    }\n  }\n": typeof types.LinkMailDocument,
    "\n  mutation UnlinkMail($id: ID!) {\n    unlinkMail(id: $id)\n  }\n": typeof types.UnlinkMailDocument,
    "\n  query MailDraft($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailDraft(accountId: $accountId, folder: $folder, uid: $uid) {\n      accountId\n      folder\n      uid\n      to {\n        address\n      }\n      cc {\n        address\n      }\n      bcc {\n        address\n      }\n      subject\n      html\n      text\n      inReplyTo\n      references\n      projectId\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n": typeof types.MailDraftDocument,
    "\n  mutation SaveMailDraft($input: SaveMailDraftInput!) {\n    saveMailDraft(input: $input) {\n      accountId\n      folder\n      uid\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n": typeof types.SaveMailDraftDocument,
    "\n  mutation DeleteMailDraft($location: MailLocationInput!) {\n    deleteMailDraft(location: $location)\n  }\n": typeof types.DeleteMailDraftDocument,
    "\n  mutation SendMail($input: SendMailInput!) {\n    sendMail(input: $input)\n  }\n": typeof types.SendMailDocument,
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n": typeof types.ContributorFieldsFragmentDoc,
    "\n  fragment SprintFields on Sprint {\n    id\n    projectId\n    name\n    goal\n    startDate\n    endDate\n  }\n": typeof types.SprintFieldsFragmentDoc,
    "\n  fragment MilestoneFields on Milestone {\n    id\n    projectId\n    title\n    description\n    dueDate\n    position\n  }\n": typeof types.MilestoneFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": typeof types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    sprintId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    recurrence\n    seriesId\n    occurrenceDate\n    closed\n    closedAt\n    githubLinked\n    githubUrl\n    githubNumber\n  }\n": typeof types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": typeof types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n    sprints {\n      ...SprintFields\n    }\n  }\n": typeof types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": typeof types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": typeof types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": typeof types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": typeof types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": typeof types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": typeof types.CloneTaskDocument,
    "\n  mutation SetTaskRecurrence($id: ID!, $recurrence: JSON) {\n    setTaskRecurrence(id: $id, recurrence: $recurrence) {\n      id\n    }\n  }\n": typeof types.SetTaskRecurrenceDocument,
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
    "\n  mutation CreateSprint($projectId: ID!, $input: SprintInput!) {\n    createSprint(projectId: $projectId, input: $input)\n  }\n": typeof types.CreateSprintDocument,
    "\n  mutation UpdateSprint($id: ID!, $input: SprintInput!) {\n    updateSprint(id: $id, input: $input)\n  }\n": typeof types.UpdateSprintDocument,
    "\n  mutation DeleteSprint($id: ID!) {\n    deleteSprint(id: $id)\n  }\n": typeof types.DeleteSprintDocument,
    "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n    documentId\n    documentNumber\n  }\n": typeof types.TimeEntryFieldsFragmentDoc,
    "\n  query TimeEntries($projectId: ID) {\n    timeEntries(projectId: $projectId) {\n      ...TimeEntryFields\n    }\n  }\n": typeof types.TimeEntriesDocument,
    "\n  query RunningTimeEntry {\n    runningTimeEntry {\n      ...TimeEntryFields\n    }\n  }\n": typeof types.RunningTimeEntryDocument,
    "\n  mutation StartTimer($input: TimerInput!) {\n    startTimer(input: $input) {\n      id\n    }\n  }\n": typeof types.StartTimerDocument,
    "\n  mutation SetTimerPaused($paused: Boolean!) {\n    setTimerPaused(paused: $paused) {\n      id\n    }\n  }\n": typeof types.SetTimerPausedDocument,
    "\n  mutation StopTimer {\n    stopTimer {\n      id\n    }\n  }\n": typeof types.StopTimerDocument,
    "\n  mutation CreateTimeEntry($input: TimeEntryInput!) {\n    createTimeEntry(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateTimeEntryDocument,
    "\n  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {\n    updateTimeEntry(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateTimeEntryDocument,
    "\n  mutation DeleteTimeEntry($id: ID!) {\n    deleteTimeEntry(id: $id)\n  }\n": typeof types.DeleteTimeEntryDocument,
    "\n  fragment TreasuryEntryFields on TreasuryEntry {\n    id\n    accountId\n    accountName\n    status\n    date\n    label\n    amount\n    category\n    method\n    projectId\n    note\n    recurrence\n    allocations {\n      id\n      amount\n      documentId\n      importedDocumentId\n      documentLabel\n    }\n  }\n": typeof types.TreasuryEntryFieldsFragmentDoc,
    "\n  query TreasuryAccounts {\n    treasuryAccounts {\n      id\n      name\n      openingBalance\n      openingDate\n      archived\n      entryCount\n      balance\n    }\n  }\n": typeof types.TreasuryAccountsDocument,
    "\n  query TreasuryEntries($from: Date!, $to: Date!, $accountId: ID) {\n    treasuryEntries(from: $from, to: $to, accountId: $accountId) {\n      ...TreasuryEntryFields\n    }\n  }\n": typeof types.TreasuryEntriesDocument,
    "\n  query ForecastEntries {\n    forecastEntries {\n      ...TreasuryEntryFields\n    }\n  }\n": typeof types.ForecastEntriesDocument,
    "\n  query TreasuryProjection($today: Date!, $from: Date!, $until: Date!) {\n    treasuryProjection(today: $today, from: $from, until: $until) {\n      balance\n      series {\n        date\n        balance\n        forecast\n      }\n      items {\n        date\n        dueDate\n        label\n        amount\n        kind\n        overdue\n        entryId\n        documentId\n        importedDocumentId\n        recurringInvoiceId\n        accountId\n      }\n    }\n  }\n": typeof types.TreasuryProjectionDocument,
    "\n  mutation CreateTreasuryAccount($input: TreasuryAccountInput!) {\n    createTreasuryAccount(input: $input)\n  }\n": typeof types.CreateTreasuryAccountDocument,
    "\n  mutation UpdateTreasuryAccount($id: ID!, $input: TreasuryAccountInput!) {\n    updateTreasuryAccount(id: $id, input: $input)\n  }\n": typeof types.UpdateTreasuryAccountDocument,
    "\n  mutation DeleteTreasuryAccount($id: ID!) {\n    deleteTreasuryAccount(id: $id)\n  }\n": typeof types.DeleteTreasuryAccountDocument,
    "\n  mutation CreateTreasuryEntry($input: TreasuryEntryInput!) {\n    createTreasuryEntry(input: $input)\n  }\n": typeof types.CreateTreasuryEntryDocument,
    "\n  mutation UpdateTreasuryEntry($id: ID!, $input: TreasuryEntryInput!) {\n    updateTreasuryEntry(id: $id, input: $input)\n  }\n": typeof types.UpdateTreasuryEntryDocument,
    "\n  mutation DeleteTreasuryEntry($id: ID!) {\n    deleteTreasuryEntry(id: $id)\n  }\n": typeof types.DeleteTreasuryEntryDocument,
    "\n  mutation RealizeTreasuryForecast($id: ID!, $occurrence: Date!, $date: Date!, $amount: Float!) {\n    realizeTreasuryForecast(id: $id, occurrence: $occurrence, date: $date, amount: $amount)\n  }\n": typeof types.RealizeTreasuryForecastDocument,
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
    "\n  fragment CompanyProfileFields on CompanyProfile {\n    name\n    legalForm\n    capital\n    registration\n    siren\n    siret\n    activityCode\n    vatNumber\n    vatApplicable\n    vatExemptionText\n    address\n    email\n    phone\n    website\n    logoUrl\n    bankName\n    accountHolder\n    iban\n    bic\n    paymentTerms\n    paymentDays\n    paymentMethods\n    lateInterest\n    otherMentions\n    referenceLabel\n    quoteValidityDays\n  }\n": types.CompanyProfileFieldsFragmentDoc,
    "\n  query CompanyProfile {\n    companyProfile {\n      ...CompanyProfileFields\n    }\n  }\n": types.CompanyProfileDocument,
    "\n  query DocumentSequences($year: Int!) {\n    documentSequences(year: $year) {\n      type\n      year\n      nextNumber\n      minimum\n    }\n  }\n": types.DocumentSequencesDocument,
    "\n  query ClientBilling($id: ID!) {\n    client(id: $id) {\n      id\n      name\n      kind\n      firstName\n      lastName\n      address\n      email\n      phones\n      website\n      vatNumber\n      siren\n      siret\n      activityCode\n      services {\n        id\n        name\n        address\n        email\n        phones\n      }\n      contacts {\n        id\n        serviceId\n        firstName\n        lastName\n        email\n        jobTitle\n        phones\n      }\n    }\n  }\n": types.ClientBillingDocument,
    "\n  mutation UpdateCompanyProfile($input: CompanyProfileInput!) {\n    updateCompanyProfile(input: $input) {\n      name\n    }\n  }\n": types.UpdateCompanyProfileDocument,
    "\n  mutation SetCompanyLogo($file: File) {\n    setCompanyLogo(file: $file) {\n      logoUrl\n    }\n  }\n": types.SetCompanyLogoDocument,
    "\n  mutation SetDocumentSequence($type: AccountingDocumentType!, $year: Int!, $nextNumber: Int!) {\n    setDocumentSequence(type: $type, year: $year, nextNumber: $nextNumber)\n  }\n": types.SetDocumentSequenceDocument,
    "\n  mutation UpdateClientDetails($id: ID!, $input: ClientDetailsInput!) {\n    updateClientDetails(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateClientDetailsDocument,
    "\n  mutation CreateClientService($clientId: ID!, $input: ClientServiceInput!) {\n    createClientService(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n": types.CreateClientServiceDocument,
    "\n  mutation UpdateClientService($id: ID!, $input: ClientServiceInput!) {\n    updateClientService(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateClientServiceDocument,
    "\n  mutation DeleteClientService($id: ID!) {\n    deleteClientService(id: $id)\n  }\n": types.DeleteClientServiceDocument,
    "\n  mutation CreateClientContact($clientId: ID!, $input: ClientContactInput!) {\n    createClientContact(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n": types.CreateClientContactDocument,
    "\n  mutation UpdateClientContact($id: ID!, $input: ClientContactInput!) {\n    updateClientContact(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateClientContactDocument,
    "\n  mutation DeleteClientContact($id: ID!) {\n    deleteClientContact(id: $id)\n  }\n": types.DeleteClientContactDocument,
    "\n  query CatalogItems {\n    catalogItems {\n      id\n      kind\n      title\n      description\n      unit\n      unitPrice\n      vatRate\n      archived\n    }\n  }\n": types.CatalogItemsDocument,
    "\n  mutation CreateCatalogItem($input: CatalogItemInput!) {\n    createCatalogItem(input: $input)\n  }\n": types.CreateCatalogItemDocument,
    "\n  mutation UpdateCatalogItem($id: ID!, $input: CatalogItemInput!) {\n    updateCatalogItem(id: $id, input: $input)\n  }\n": types.UpdateCatalogItemDocument,
    "\n  mutation DeleteCatalogItem($id: ID!) {\n    deleteCatalogItem(id: $id)\n  }\n": types.DeleteCatalogItemDocument,
    "\n  fragment AccountingDocumentListFields on AccountingDocument {\n    id\n    type\n    status\n    number\n    issueDate\n    dueDate\n    clientId\n    clientName\n    projectId\n    title\n    totalNet\n    totalGross\n    currency\n    invoicedNet\n    sourceNumber\n    recurringId\n    trackingStatus {\n      id\n      name\n      color\n      category\n    }\n    balance\n    overdue\n  }\n": types.AccountingDocumentListFieldsFragmentDoc,
    "\n  fragment AccountingDocumentFields on AccountingDocument {\n    ...AccountingDocumentListFields\n    serviceStart\n    serviceEnd\n    serviceId\n    contactId\n    sourceId\n    derived {\n      id\n      type\n      status\n      number\n      totalGross\n    }\n    seller\n    buyer\n    introduction\n    referenceLabel\n    referenceValue\n    conclusion\n    paymentTerms\n    paymentMethods\n    lateInterest\n    depositType\n    depositValue\n    billingSchedule\n    otherMentions\n    timeEntries {\n      id\n      projectId\n      description\n      startedAt\n      duration\n    }\n    showBankDetails\n    vatApplicable\n    vatExemptionText\n    globalDiscountType\n    globalDiscountValue\n    totalVat\n    finalizedAt\n    updatedAt\n    sentAt\n    acceptedAt\n    signedFileUrl\n    signedFileName\n    paid\n    credited\n    reminders {\n      id\n      date\n      note\n    }\n    payments {\n      id\n      amount\n      entry {\n        id\n        date\n        accountName\n        method\n      }\n    }\n    lines {\n      id\n      kind\n      title\n      description\n      quantity\n      unit\n      unitPrice\n      vatRate\n      discountType\n      discountValue\n    }\n    attachments {\n      id\n      name\n      size\n      url\n    }\n  }\n": types.AccountingDocumentFieldsFragmentDoc,
    "\n  query AccountingDocuments($clientId: ID, $projectId: ID) {\n    accountingDocuments(clientId: $clientId, projectId: $projectId) {\n      ...AccountingDocumentListFields\n    }\n  }\n": types.AccountingDocumentsDocument,
    "\n  query AccountingDocument($id: ID!) {\n    accountingDocument(id: $id) {\n      ...AccountingDocumentFields\n    }\n  }\n": types.AccountingDocumentDocument,
    "\n  query NewDocumentDefaults($type: AccountingDocumentType!, $clientId: ID!, $issueDate: Date!) {\n    newDocumentDefaults(type: $type, clientId: $clientId, issueDate: $issueDate)\n  }\n": types.NewDocumentDefaultsDocument,
    "\n  query RecurringInvoices {\n    recurringInvoices {\n      id\n      name\n      templateId\n      recurrence\n      startDate\n      nextDate\n      autoFinalize\n      active\n      issuedCount\n      template {\n        clientName\n        totalGross\n        currency\n      }\n    }\n  }\n": types.RecurringInvoicesDocument,
    "\n  query ProjectResources($projectId: ID!) {\n    projectResources(projectId: $projectId) {\n      id\n      kind\n      title\n      note\n      url\n      size\n      createdAt\n    }\n  }\n": types.ProjectResourcesDocument,
    "\n  mutation CreateAccountingDocument($type: AccountingDocumentType!, $input: AccountingDocumentInput!) {\n    createAccountingDocument(type: $type, input: $input)\n  }\n": types.CreateAccountingDocumentDocument,
    "\n  mutation UpdateAccountingDocument($id: ID!, $input: AccountingDocumentInput!) {\n    updateAccountingDocument(id: $id, input: $input)\n  }\n": types.UpdateAccountingDocumentDocument,
    "\n  mutation DeleteAccountingDocument($id: ID!) {\n    deleteAccountingDocument(id: $id)\n  }\n": types.DeleteAccountingDocumentDocument,
    "\n  mutation FinalizeAccountingDocument($id: ID!) {\n    finalizeAccountingDocument(id: $id)\n  }\n": types.FinalizeAccountingDocumentDocument,
    "\n  mutation CreateDocumentFrom($sourceId: ID!, $type: AccountingDocumentType!, $depositPercent: Float, $issueDate: Date!) {\n    createDocumentFrom(sourceId: $sourceId, type: $type, depositPercent: $depositPercent, issueDate: $issueDate)\n  }\n": types.CreateDocumentFromDocument,
    "\n  mutation DuplicateAccountingDocument($id: ID!, $issueDate: Date!) {\n    duplicateAccountingDocument(id: $id, issueDate: $issueDate)\n  }\n": types.DuplicateAccountingDocumentDocument,
    "\n  mutation AddAccountingAttachments($id: ID!, $files: [File!]!) {\n    addAccountingAttachments(id: $id, files: $files)\n  }\n": types.AddAccountingAttachmentsDocument,
    "\n  mutation RemoveAccountingAttachment($attachmentId: ID!) {\n    removeAccountingAttachment(attachmentId: $attachmentId)\n  }\n": types.RemoveAccountingAttachmentDocument,
    "\n  mutation CreateRecurringInvoice($documentId: ID!, $input: RecurringInvoiceInput!) {\n    createRecurringInvoice(documentId: $documentId, input: $input)\n  }\n": types.CreateRecurringInvoiceDocument,
    "\n  mutation UpdateRecurringInvoice($id: ID!, $input: RecurringInvoiceInput!) {\n    updateRecurringInvoice(id: $id, input: $input)\n  }\n": types.UpdateRecurringInvoiceDocument,
    "\n  mutation DeleteRecurringInvoice($id: ID!) {\n    deleteRecurringInvoice(id: $id)\n  }\n": types.DeleteRecurringInvoiceDocument,
    "\n  mutation AddProjectLink($projectId: ID!, $title: String!, $url: String!, $note: String) {\n    addProjectLink(projectId: $projectId, title: $title, url: $url, note: $note)\n  }\n": types.AddProjectLinkDocument,
    "\n  mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {\n    addProjectFiles(projectId: $projectId, files: $files)\n  }\n": types.AddProjectFilesDocument,
    "\n  mutation UpdateProjectResource($id: ID!, $title: String!, $url: String, $note: String) {\n    updateProjectResource(id: $id, title: $title, url: $url, note: $note)\n  }\n": types.UpdateProjectResourceDocument,
    "\n  mutation DeleteProjectResource($id: ID!) {\n    deleteProjectResource(id: $id)\n  }\n": types.DeleteProjectResourceDocument,
    "\n  mutation MoveProjectResource($id: ID!, $index: Int!) {\n    moveProjectResource(id: $id, index: $index)\n  }\n": types.MoveProjectResourceDocument,
    "\n  query ImportedDocuments($clientId: ID, $projectId: ID) {\n    importedDocuments(clientId: $clientId, projectId: $projectId) {\n      id\n      type\n      number\n      issueDate\n      dueDate\n      clientId\n      clientName\n      projectId\n      title\n      totalNet\n      totalVat\n      totalGross\n      currency\n      note\n      fileUrl\n      fileName\n      settled\n      paid\n      balance\n    }\n  }\n": types.ImportedDocumentsDocument,
    "\n  mutation ImportDocument($input: ImportedDocumentInput!, $file: File) {\n    importDocument(input: $input, file: $file)\n  }\n": types.ImportDocumentDocument,
    "\n  mutation UpdateImportedDocument($id: ID!, $input: ImportedDocumentInput!, $file: File) {\n    updateImportedDocument(id: $id, input: $input, file: $file)\n  }\n": types.UpdateImportedDocumentDocument,
    "\n  mutation DeleteImportedDocument($id: ID!) {\n    deleteImportedDocument(id: $id)\n  }\n": types.DeleteImportedDocumentDocument,
    "\n  query DocumentStatuses {\n    documentStatuses {\n      id\n      scope\n      name\n      color\n      category\n      position\n      documentCount\n    }\n  }\n": types.DocumentStatusesDocument,
    "\n  query OverdueInvoices($today: Date!) {\n    overdueInvoices(today: $today) {\n      id\n      type\n      number\n      clientId\n      clientName\n      projectId\n      contactId\n      serviceId\n      issueDate\n      dueDate\n      totalGross\n      currency\n      balance\n      billingEmail\n      reminderCount\n      lastReminderAt\n    }\n  }\n": types.OverdueInvoicesDocument,
    "\n  mutation SendDocumentReminders($accountId: ID!, $documentIds: [ID!]!) {\n    sendDocumentReminders(accountId: $accountId, documentIds: $documentIds) {\n      documentId\n      number\n      error\n    }\n  }\n": types.SendDocumentRemindersDocument,
    "\n  mutation CreateDocumentStatus($scope: DocumentStatusScope!, $name: String!, $color: String!, $category: DocumentStatusCategory!) {\n    createDocumentStatus(scope: $scope, name: $name, color: $color, category: $category)\n  }\n": types.CreateDocumentStatusDocument,
    "\n  mutation UpdateDocumentStatus($id: ID!, $name: String, $color: String, $category: DocumentStatusCategory) {\n    updateDocumentStatus(id: $id, name: $name, color: $color, category: $category)\n  }\n": types.UpdateDocumentStatusDocument,
    "\n  mutation DeleteDocumentStatus($id: ID!) {\n    deleteDocumentStatus(id: $id)\n  }\n": types.DeleteDocumentStatusDocument,
    "\n  mutation MoveDocumentStatus($id: ID!, $index: Int!) {\n    moveDocumentStatus(id: $id, index: $index)\n  }\n": types.MoveDocumentStatusDocument,
    "\n  mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {\n    setDocumentTrackingStatus(id: $id, statusId: $statusId)\n  }\n": types.SetDocumentTrackingStatusDocument,
    "\n  mutation MarkDocumentSent($id: ID!) {\n    markDocumentSent(id: $id)\n  }\n": types.MarkDocumentSentDocument,
    "\n  mutation AcceptQuote($id: ID!, $date: Date!, $file: File) {\n    acceptQuote(id: $id, date: $date, file: $file)\n  }\n": types.AcceptQuoteDocument,
    "\n  mutation RemoveSignedQuote($id: ID!) {\n    removeSignedQuote(id: $id)\n  }\n": types.RemoveSignedQuoteDocument,
    "\n  mutation AddDocumentReminder($id: ID!, $note: String) {\n    addDocumentReminder(id: $id, note: $note)\n  }\n": types.AddDocumentReminderDocument,
    "\n  mutation DeleteDocumentReminder($id: ID!) {\n    deleteDocumentReminder(id: $id)\n  }\n": types.DeleteDocumentReminderDocument,
    "\n  mutation RecordDocumentPayment($id: ID!, $input: DocumentPaymentInput!) {\n    recordDocumentPayment(id: $id, input: $input)\n  }\n": types.RecordDocumentPaymentDocument,
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
    "\n  fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {\n    key\n    eventId\n    occurrenceDate\n    modified\n    title\n    description\n    location\n    links {\n      url\n      label\n    }\n    allDay\n    startDate\n    startTime\n    endDate\n    endTime\n    timeZone\n    start\n    end\n    recurrence\n    seriesStartDate\n    reminders\n    projectId\n    contributorIds\n    categoryIds\n  }\n": types.CalendarEventOccurrenceFieldsFragmentDoc,
    "\n  query CalendarCategories {\n    calendarCategories {\n      id\n      name\n      color\n      parentId\n      position\n    }\n  }\n": types.CalendarCategoriesDocument,
    "\n  query CalendarEvents($from: Date!, $to: Date!) {\n    calendarEvents(from: $from, to: $to) {\n      ...CalendarEventOccurrenceFields\n    }\n  }\n": types.CalendarEventsDocument,
    "\n  mutation CreateCalendarCategory($input: CalendarCategoryInput!) {\n    createCalendarCategory(input: $input) {\n      id\n    }\n  }\n": types.CreateCalendarCategoryDocument,
    "\n  mutation UpdateCalendarCategory($id: ID!, $input: CalendarCategoryInput!) {\n    updateCalendarCategory(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateCalendarCategoryDocument,
    "\n  mutation DeleteCalendarCategory($id: ID!) {\n    deleteCalendarCategory(id: $id)\n  }\n": types.DeleteCalendarCategoryDocument,
    "\n  mutation MoveCalendarCategory($id: ID!, $index: Int!) {\n    moveCalendarCategory(id: $id, index: $index)\n  }\n": types.MoveCalendarCategoryDocument,
    "\n  mutation CreateCalendarEvent($input: CalendarEventInput!) {\n    createCalendarEvent(input: $input)\n  }\n": types.CreateCalendarEventDocument,
    "\n  mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    updateCalendarEvent(id: $id, input: $input, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n": types.UpdateCalendarEventDocument,
    "\n  mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n": types.DeleteCalendarEventDocument,
    "\n  mutation MaterializeTaskOccurrences($from: Date!, $to: Date!) {\n    materializeTaskOccurrences(from: $from, to: $to)\n  }\n": types.MaterializeTaskOccurrencesDocument,
    "\n  query Dashboards($projectId: ID) {\n    dashboards(projectId: $projectId) {\n      id\n      projectId\n      name\n      position\n      charts {\n        id\n        dashboardId\n        title\n        config\n        wide\n        position\n      }\n    }\n  }\n": types.DashboardsDocument,
    "\n  mutation CreateDashboard($name: String!, $projectId: ID) {\n    createDashboard(name: $name, projectId: $projectId)\n  }\n": types.CreateDashboardDocument,
    "\n  mutation RenameDashboard($id: ID!, $name: String!) {\n    renameDashboard(id: $id, name: $name)\n  }\n": types.RenameDashboardDocument,
    "\n  mutation DeleteDashboard($id: ID!) {\n    deleteDashboard(id: $id)\n  }\n": types.DeleteDashboardDocument,
    "\n  mutation MoveDashboard($id: ID!, $index: Int!) {\n    moveDashboard(id: $id, index: $index)\n  }\n": types.MoveDashboardDocument,
    "\n  mutation CreateDashboardChart($dashboardId: ID!, $input: DashboardChartInput!) {\n    createDashboardChart(dashboardId: $dashboardId, input: $input)\n  }\n": types.CreateDashboardChartDocument,
    "\n  mutation UpdateDashboardChart($id: ID!, $input: DashboardChartInput!) {\n    updateDashboardChart(id: $id, input: $input)\n  }\n": types.UpdateDashboardChartDocument,
    "\n  mutation DuplicateDashboardChart($id: ID!) {\n    duplicateDashboardChart(id: $id)\n  }\n": types.DuplicateDashboardChartDocument,
    "\n  mutation DeleteDashboardChart($id: ID!) {\n    deleteDashboardChart(id: $id)\n  }\n": types.DeleteDashboardChartDocument,
    "\n  mutation MoveDashboardChart($id: ID!, $index: Int!) {\n    moveDashboardChart(id: $id, index: $index)\n  }\n": types.MoveDashboardChartDocument,
    "\n  query GithubLogin {\n    githubLogin\n  }\n": types.GithubLoginDocument,
    "\n  query GithubContributors {\n    githubContributors {\n      id\n      name\n      githubLogin\n    }\n  }\n": types.GithubContributorsDocument,
    "\n  query GithubBoard($url: String!) {\n    githubBoard(url: $url) {\n      id\n      title\n      url\n      fields {\n        id\n        name\n        dataType\n        iterationCount\n        options {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.GithubBoardDocument,
    "\n  query GithubProjectLink($projectId: ID!) {\n    githubProjectLink(projectId: $projectId) {\n      id\n      projectId\n      url\n      title\n      statusFieldId\n      priorityFieldId\n      iterationFieldId\n      startFieldId\n      endFieldId\n      effortFieldId\n      statusOptions\n      priorityOptions\n      repositoryName\n      pushExisting\n      enabled\n      lastSyncAt\n      lastSyncError\n      lastSyncSummary\n      linkedTaskCount\n    }\n  }\n": types.GithubProjectLinkDocument,
    "\n  mutation SetGithubToken($token: String!) {\n    setGithubToken(token: $token)\n  }\n": types.SetGithubTokenDocument,
    "\n  mutation RemoveGithubToken {\n    removeGithubToken\n  }\n": types.RemoveGithubTokenDocument,
    "\n  mutation SaveGithubLink($projectId: ID!, $input: GithubLinkInput!) {\n    saveGithubLink(projectId: $projectId, input: $input)\n  }\n": types.SaveGithubLinkDocument,
    "\n  mutation UnlinkGithubProject($projectId: ID!) {\n    unlinkGithubProject(projectId: $projectId)\n  }\n": types.UnlinkGithubProjectDocument,
    "\n  mutation SyncGithubProject($projectId: ID!) {\n    syncGithubProject(projectId: $projectId) {\n      pulledNew\n      pushedNew\n      pulled\n      pushed\n      unlinked\n      sprints\n    }\n  }\n": types.SyncGithubProjectDocument,
    "\n  mutation SetContributorGithubLogin($id: ID!, $login: String) {\n    setContributorGithubLogin(id: $id, login: $login)\n  }\n": types.SetContributorGithubLoginDocument,
    "\n  fragment MailAccountFields on MailAccount {\n    id\n    name\n    email\n    displayName\n    imapHost\n    imapPort\n    imapSecure\n    imapUser\n    smtpHost\n    smtpPort\n    smtpSecure\n    smtpUser\n    saveSent\n    signature\n  }\n": types.MailAccountFieldsFragmentDoc,
    "\n  fragment MailViewFields on MailView {\n    accountId\n    folder\n    uid\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    replyTo {\n      name\n      address\n    }\n    date\n    html\n    text\n    attachments {\n      index\n      filename\n      contentType\n      size\n      inline\n    }\n    linkedProjectIds\n  }\n": types.MailViewFieldsFragmentDoc,
    "\n  fragment LinkedMailFields on LinkedMail {\n    id\n    projectId\n    accountId\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    date\n    html\n    text\n    sent\n    attachments {\n      id\n      name\n      size\n      inline\n      url\n    }\n  }\n": types.LinkedMailFieldsFragmentDoc,
    "\n  query MailAccounts {\n    mailAccounts {\n      ...MailAccountFields\n    }\n  }\n": types.MailAccountsDocument,
    "\n  query MailFolders($accountId: ID!) {\n    mailFolders(accountId: $accountId) {\n      path\n      name\n      specialUse\n      unseen\n      depth\n    }\n  }\n": types.MailFoldersDocument,
    "\n  query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String) {\n    mailMessages(accountId: $accountId, folder: $folder, page: $page, search: $search) {\n      total\n      pageSize\n      messages {\n        uid\n        subject\n        from {\n          name\n          address\n        }\n        to {\n          name\n          address\n        }\n        date\n        seen\n        flagged\n        hasAttachments\n      }\n    }\n  }\n": types.MailMessagesDocument,
    "\n  query MailMessage($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailMessage(accountId: $accountId, folder: $folder, uid: $uid) {\n      ...MailViewFields\n    }\n  }\n": types.MailMessageDocument,
    "\n  query UnreadMailCount {\n    unreadMailCount\n  }\n": types.UnreadMailCountDocument,
    "\n  query ProjectMails($projectId: ID!) {\n    projectMails(projectId: $projectId) {\n      ...LinkedMailFields\n    }\n  }\n": types.ProjectMailsDocument,
    "\n  mutation TestMailAccount($input: MailAccountInput!, $id: ID) {\n    testMailAccount(input: $input, id: $id)\n  }\n": types.TestMailAccountDocument,
    "\n  mutation CreateMailAccount($input: MailAccountInput!) {\n    createMailAccount(input: $input) {\n      id\n    }\n  }\n": types.CreateMailAccountDocument,
    "\n  mutation UpdateMailAccount($id: ID!, $input: MailAccountInput!) {\n    updateMailAccount(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateMailAccountDocument,
    "\n  mutation SetMailSignature($id: ID!, $signature: String!) {\n    setMailSignature(id: $id, signature: $signature) {\n      id\n    }\n  }\n": types.SetMailSignatureDocument,
    "\n  mutation DeleteMailAccount($id: ID!) {\n    deleteMailAccount(id: $id)\n  }\n": types.DeleteMailAccountDocument,
    "\n  mutation MoveMailAccount($id: ID!, $index: Int!) {\n    moveMailAccount(id: $id, index: $index)\n  }\n": types.MoveMailAccountDocument,
    "\n  mutation SetMailSeen($accountId: ID!, $folder: String!, $uids: [Int!]!, $seen: Boolean!) {\n    setMailSeen(accountId: $accountId, folder: $folder, uids: $uids, seen: $seen)\n  }\n": types.SetMailSeenDocument,
    "\n  mutation DeleteMails($accountId: ID!, $folder: String!, $uids: [Int!]!) {\n    deleteMails(accountId: $accountId, folder: $folder, uids: $uids)\n  }\n": types.DeleteMailsDocument,
    "\n  mutation LinkMail($accountId: ID!, $folder: String!, $uid: Int!, $projectId: ID!) {\n    linkMail(accountId: $accountId, folder: $folder, uid: $uid, projectId: $projectId) {\n      id\n    }\n  }\n": types.LinkMailDocument,
    "\n  mutation UnlinkMail($id: ID!) {\n    unlinkMail(id: $id)\n  }\n": types.UnlinkMailDocument,
    "\n  query MailDraft($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailDraft(accountId: $accountId, folder: $folder, uid: $uid) {\n      accountId\n      folder\n      uid\n      to {\n        address\n      }\n      cc {\n        address\n      }\n      bcc {\n        address\n      }\n      subject\n      html\n      text\n      inReplyTo\n      references\n      projectId\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n": types.MailDraftDocument,
    "\n  mutation SaveMailDraft($input: SaveMailDraftInput!) {\n    saveMailDraft(input: $input) {\n      accountId\n      folder\n      uid\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n": types.SaveMailDraftDocument,
    "\n  mutation DeleteMailDraft($location: MailLocationInput!) {\n    deleteMailDraft(location: $location)\n  }\n": types.DeleteMailDraftDocument,
    "\n  mutation SendMail($input: SendMailInput!) {\n    sendMail(input: $input)\n  }\n": types.SendMailDocument,
    "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n": types.ContributorFieldsFragmentDoc,
    "\n  fragment SprintFields on Sprint {\n    id\n    projectId\n    name\n    goal\n    startDate\n    endDate\n  }\n": types.SprintFieldsFragmentDoc,
    "\n  fragment MilestoneFields on Milestone {\n    id\n    projectId\n    title\n    description\n    dueDate\n    position\n  }\n": types.MilestoneFieldsFragmentDoc,
    "\n  fragment TaskLabelFields on TaskStatus {\n    id\n    name\n    color\n    position\n  }\n": types.TaskLabelFieldsFragmentDoc,
    "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    sprintId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    recurrence\n    seriesId\n    occurrenceDate\n    closed\n    closedAt\n    githubLinked\n    githubUrl\n    githubNumber\n  }\n": types.TaskFieldsFragmentDoc,
    "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n": types.TaskCommentFieldsFragmentDoc,
    "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n    sprints {\n      ...SprintFields\n    }\n  }\n": types.TasksDataDocument,
    "\n  query TaskComments($number: Int!) {\n    task(number: $number) {\n      id\n      comments {\n        ...TaskCommentFields\n      }\n    }\n  }\n": types.TaskCommentsDocument,
    "\n  mutation CreateTask($input: TaskInput!) {\n    createTask(input: $input) {\n      ...TaskFields\n    }\n  }\n": types.CreateTaskDocument,
    "\n  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {\n    updateTask(id: $id, input: $input) {\n      ...TaskFields\n    }\n  }\n": types.UpdateTaskDocument,
    "\n  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {\n    setTaskArchived(id: $id, archived: $archived) {\n      id\n    }\n  }\n": types.SetTaskArchivedDocument,
    "\n  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {\n    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)\n  }\n": types.DeleteTaskDocument,
    "\n  mutation TransferTask($id: ID!, $projectId: ID!) {\n    transferTask(id: $id, projectId: $projectId) {\n      removedLinks\n    }\n  }\n": types.TransferTaskDocument,
    "\n  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {\n    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {\n      id\n      number\n    }\n  }\n": types.CloneTaskDocument,
    "\n  mutation SetTaskRecurrence($id: ID!, $recurrence: JSON) {\n    setTaskRecurrence(id: $id, recurrence: $recurrence) {\n      id\n    }\n  }\n": types.SetTaskRecurrenceDocument,
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
    "\n  mutation CreateSprint($projectId: ID!, $input: SprintInput!) {\n    createSprint(projectId: $projectId, input: $input)\n  }\n": types.CreateSprintDocument,
    "\n  mutation UpdateSprint($id: ID!, $input: SprintInput!) {\n    updateSprint(id: $id, input: $input)\n  }\n": types.UpdateSprintDocument,
    "\n  mutation DeleteSprint($id: ID!) {\n    deleteSprint(id: $id)\n  }\n": types.DeleteSprintDocument,
    "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n    documentId\n    documentNumber\n  }\n": types.TimeEntryFieldsFragmentDoc,
    "\n  query TimeEntries($projectId: ID) {\n    timeEntries(projectId: $projectId) {\n      ...TimeEntryFields\n    }\n  }\n": types.TimeEntriesDocument,
    "\n  query RunningTimeEntry {\n    runningTimeEntry {\n      ...TimeEntryFields\n    }\n  }\n": types.RunningTimeEntryDocument,
    "\n  mutation StartTimer($input: TimerInput!) {\n    startTimer(input: $input) {\n      id\n    }\n  }\n": types.StartTimerDocument,
    "\n  mutation SetTimerPaused($paused: Boolean!) {\n    setTimerPaused(paused: $paused) {\n      id\n    }\n  }\n": types.SetTimerPausedDocument,
    "\n  mutation StopTimer {\n    stopTimer {\n      id\n    }\n  }\n": types.StopTimerDocument,
    "\n  mutation CreateTimeEntry($input: TimeEntryInput!) {\n    createTimeEntry(input: $input) {\n      id\n    }\n  }\n": types.CreateTimeEntryDocument,
    "\n  mutation UpdateTimeEntry($id: ID!, $input: TimeEntryUpdateInput!) {\n    updateTimeEntry(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateTimeEntryDocument,
    "\n  mutation DeleteTimeEntry($id: ID!) {\n    deleteTimeEntry(id: $id)\n  }\n": types.DeleteTimeEntryDocument,
    "\n  fragment TreasuryEntryFields on TreasuryEntry {\n    id\n    accountId\n    accountName\n    status\n    date\n    label\n    amount\n    category\n    method\n    projectId\n    note\n    recurrence\n    allocations {\n      id\n      amount\n      documentId\n      importedDocumentId\n      documentLabel\n    }\n  }\n": types.TreasuryEntryFieldsFragmentDoc,
    "\n  query TreasuryAccounts {\n    treasuryAccounts {\n      id\n      name\n      openingBalance\n      openingDate\n      archived\n      entryCount\n      balance\n    }\n  }\n": types.TreasuryAccountsDocument,
    "\n  query TreasuryEntries($from: Date!, $to: Date!, $accountId: ID) {\n    treasuryEntries(from: $from, to: $to, accountId: $accountId) {\n      ...TreasuryEntryFields\n    }\n  }\n": types.TreasuryEntriesDocument,
    "\n  query ForecastEntries {\n    forecastEntries {\n      ...TreasuryEntryFields\n    }\n  }\n": types.ForecastEntriesDocument,
    "\n  query TreasuryProjection($today: Date!, $from: Date!, $until: Date!) {\n    treasuryProjection(today: $today, from: $from, until: $until) {\n      balance\n      series {\n        date\n        balance\n        forecast\n      }\n      items {\n        date\n        dueDate\n        label\n        amount\n        kind\n        overdue\n        entryId\n        documentId\n        importedDocumentId\n        recurringInvoiceId\n        accountId\n      }\n    }\n  }\n": types.TreasuryProjectionDocument,
    "\n  mutation CreateTreasuryAccount($input: TreasuryAccountInput!) {\n    createTreasuryAccount(input: $input)\n  }\n": types.CreateTreasuryAccountDocument,
    "\n  mutation UpdateTreasuryAccount($id: ID!, $input: TreasuryAccountInput!) {\n    updateTreasuryAccount(id: $id, input: $input)\n  }\n": types.UpdateTreasuryAccountDocument,
    "\n  mutation DeleteTreasuryAccount($id: ID!) {\n    deleteTreasuryAccount(id: $id)\n  }\n": types.DeleteTreasuryAccountDocument,
    "\n  mutation CreateTreasuryEntry($input: TreasuryEntryInput!) {\n    createTreasuryEntry(input: $input)\n  }\n": types.CreateTreasuryEntryDocument,
    "\n  mutation UpdateTreasuryEntry($id: ID!, $input: TreasuryEntryInput!) {\n    updateTreasuryEntry(id: $id, input: $input)\n  }\n": types.UpdateTreasuryEntryDocument,
    "\n  mutation DeleteTreasuryEntry($id: ID!) {\n    deleteTreasuryEntry(id: $id)\n  }\n": types.DeleteTreasuryEntryDocument,
    "\n  mutation RealizeTreasuryForecast($id: ID!, $occurrence: Date!, $date: Date!, $amount: Float!) {\n    realizeTreasuryForecast(id: $id, occurrence: $occurrence, date: $date, amount: $amount)\n  }\n": types.RealizeTreasuryForecastDocument,
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
export function graphql(source: "\n  fragment CompanyProfileFields on CompanyProfile {\n    name\n    legalForm\n    capital\n    registration\n    siren\n    siret\n    activityCode\n    vatNumber\n    vatApplicable\n    vatExemptionText\n    address\n    email\n    phone\n    website\n    logoUrl\n    bankName\n    accountHolder\n    iban\n    bic\n    paymentTerms\n    paymentDays\n    paymentMethods\n    lateInterest\n    otherMentions\n    referenceLabel\n    quoteValidityDays\n  }\n"): typeof import('./graphql').CompanyProfileFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CompanyProfile {\n    companyProfile {\n      ...CompanyProfileFields\n    }\n  }\n"): typeof import('./graphql').CompanyProfileDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DocumentSequences($year: Int!) {\n    documentSequences(year: $year) {\n      type\n      year\n      nextNumber\n      minimum\n    }\n  }\n"): typeof import('./graphql').DocumentSequencesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ClientBilling($id: ID!) {\n    client(id: $id) {\n      id\n      name\n      kind\n      firstName\n      lastName\n      address\n      email\n      phones\n      website\n      vatNumber\n      siren\n      siret\n      activityCode\n      services {\n        id\n        name\n        address\n        email\n        phones\n      }\n      contacts {\n        id\n        serviceId\n        firstName\n        lastName\n        email\n        jobTitle\n        phones\n      }\n    }\n  }\n"): typeof import('./graphql').ClientBillingDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCompanyProfile($input: CompanyProfileInput!) {\n    updateCompanyProfile(input: $input) {\n      name\n    }\n  }\n"): typeof import('./graphql').UpdateCompanyProfileDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetCompanyLogo($file: File) {\n    setCompanyLogo(file: $file) {\n      logoUrl\n    }\n  }\n"): typeof import('./graphql').SetCompanyLogoDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetDocumentSequence($type: AccountingDocumentType!, $year: Int!, $nextNumber: Int!) {\n    setDocumentSequence(type: $type, year: $year, nextNumber: $nextNumber)\n  }\n"): typeof import('./graphql').SetDocumentSequenceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateClientDetails($id: ID!, $input: ClientDetailsInput!) {\n    updateClientDetails(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateClientDetailsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateClientService($clientId: ID!, $input: ClientServiceInput!) {\n    createClientService(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateClientServiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateClientService($id: ID!, $input: ClientServiceInput!) {\n    updateClientService(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateClientServiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteClientService($id: ID!) {\n    deleteClientService(id: $id)\n  }\n"): typeof import('./graphql').DeleteClientServiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateClientContact($clientId: ID!, $input: ClientContactInput!) {\n    createClientContact(clientId: $clientId, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateClientContactDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateClientContact($id: ID!, $input: ClientContactInput!) {\n    updateClientContact(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateClientContactDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteClientContact($id: ID!) {\n    deleteClientContact(id: $id)\n  }\n"): typeof import('./graphql').DeleteClientContactDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CatalogItems {\n    catalogItems {\n      id\n      kind\n      title\n      description\n      unit\n      unitPrice\n      vatRate\n      archived\n    }\n  }\n"): typeof import('./graphql').CatalogItemsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateCatalogItem($input: CatalogItemInput!) {\n    createCatalogItem(input: $input)\n  }\n"): typeof import('./graphql').CreateCatalogItemDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCatalogItem($id: ID!, $input: CatalogItemInput!) {\n    updateCatalogItem(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateCatalogItemDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteCatalogItem($id: ID!) {\n    deleteCatalogItem(id: $id)\n  }\n"): typeof import('./graphql').DeleteCatalogItemDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AccountingDocumentListFields on AccountingDocument {\n    id\n    type\n    status\n    number\n    issueDate\n    dueDate\n    clientId\n    clientName\n    projectId\n    title\n    totalNet\n    totalGross\n    currency\n    invoicedNet\n    sourceNumber\n    recurringId\n    trackingStatus {\n      id\n      name\n      color\n      category\n    }\n    balance\n    overdue\n  }\n"): typeof import('./graphql').AccountingDocumentListFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AccountingDocumentFields on AccountingDocument {\n    ...AccountingDocumentListFields\n    serviceStart\n    serviceEnd\n    serviceId\n    contactId\n    sourceId\n    derived {\n      id\n      type\n      status\n      number\n      totalGross\n    }\n    seller\n    buyer\n    introduction\n    referenceLabel\n    referenceValue\n    conclusion\n    paymentTerms\n    paymentMethods\n    lateInterest\n    depositType\n    depositValue\n    billingSchedule\n    otherMentions\n    timeEntries {\n      id\n      projectId\n      description\n      startedAt\n      duration\n    }\n    showBankDetails\n    vatApplicable\n    vatExemptionText\n    globalDiscountType\n    globalDiscountValue\n    totalVat\n    finalizedAt\n    updatedAt\n    sentAt\n    acceptedAt\n    signedFileUrl\n    signedFileName\n    paid\n    credited\n    reminders {\n      id\n      date\n      note\n    }\n    payments {\n      id\n      amount\n      entry {\n        id\n        date\n        accountName\n        method\n      }\n    }\n    lines {\n      id\n      kind\n      title\n      description\n      quantity\n      unit\n      unitPrice\n      vatRate\n      discountType\n      discountValue\n    }\n    attachments {\n      id\n      name\n      size\n      url\n    }\n  }\n"): typeof import('./graphql').AccountingDocumentFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AccountingDocuments($clientId: ID, $projectId: ID) {\n    accountingDocuments(clientId: $clientId, projectId: $projectId) {\n      ...AccountingDocumentListFields\n    }\n  }\n"): typeof import('./graphql').AccountingDocumentsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AccountingDocument($id: ID!) {\n    accountingDocument(id: $id) {\n      ...AccountingDocumentFields\n    }\n  }\n"): typeof import('./graphql').AccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NewDocumentDefaults($type: AccountingDocumentType!, $clientId: ID!, $issueDate: Date!) {\n    newDocumentDefaults(type: $type, clientId: $clientId, issueDate: $issueDate)\n  }\n"): typeof import('./graphql').NewDocumentDefaultsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecurringInvoices {\n    recurringInvoices {\n      id\n      name\n      templateId\n      recurrence\n      startDate\n      nextDate\n      autoFinalize\n      active\n      issuedCount\n      template {\n        clientName\n        totalGross\n        currency\n      }\n    }\n  }\n"): typeof import('./graphql').RecurringInvoicesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProjectResources($projectId: ID!) {\n    projectResources(projectId: $projectId) {\n      id\n      kind\n      title\n      note\n      url\n      size\n      createdAt\n    }\n  }\n"): typeof import('./graphql').ProjectResourcesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateAccountingDocument($type: AccountingDocumentType!, $input: AccountingDocumentInput!) {\n    createAccountingDocument(type: $type, input: $input)\n  }\n"): typeof import('./graphql').CreateAccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateAccountingDocument($id: ID!, $input: AccountingDocumentInput!) {\n    updateAccountingDocument(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateAccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteAccountingDocument($id: ID!) {\n    deleteAccountingDocument(id: $id)\n  }\n"): typeof import('./graphql').DeleteAccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FinalizeAccountingDocument($id: ID!) {\n    finalizeAccountingDocument(id: $id)\n  }\n"): typeof import('./graphql').FinalizeAccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateDocumentFrom($sourceId: ID!, $type: AccountingDocumentType!, $depositPercent: Float, $issueDate: Date!) {\n    createDocumentFrom(sourceId: $sourceId, type: $type, depositPercent: $depositPercent, issueDate: $issueDate)\n  }\n"): typeof import('./graphql').CreateDocumentFromDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DuplicateAccountingDocument($id: ID!, $issueDate: Date!) {\n    duplicateAccountingDocument(id: $id, issueDate: $issueDate)\n  }\n"): typeof import('./graphql').DuplicateAccountingDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddAccountingAttachments($id: ID!, $files: [File!]!) {\n    addAccountingAttachments(id: $id, files: $files)\n  }\n"): typeof import('./graphql').AddAccountingAttachmentsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveAccountingAttachment($attachmentId: ID!) {\n    removeAccountingAttachment(attachmentId: $attachmentId)\n  }\n"): typeof import('./graphql').RemoveAccountingAttachmentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateRecurringInvoice($documentId: ID!, $input: RecurringInvoiceInput!) {\n    createRecurringInvoice(documentId: $documentId, input: $input)\n  }\n"): typeof import('./graphql').CreateRecurringInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateRecurringInvoice($id: ID!, $input: RecurringInvoiceInput!) {\n    updateRecurringInvoice(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateRecurringInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteRecurringInvoice($id: ID!) {\n    deleteRecurringInvoice(id: $id)\n  }\n"): typeof import('./graphql').DeleteRecurringInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddProjectLink($projectId: ID!, $title: String!, $url: String!, $note: String) {\n    addProjectLink(projectId: $projectId, title: $title, url: $url, note: $note)\n  }\n"): typeof import('./graphql').AddProjectLinkDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddProjectFiles($projectId: ID!, $files: [File!]!) {\n    addProjectFiles(projectId: $projectId, files: $files)\n  }\n"): typeof import('./graphql').AddProjectFilesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProjectResource($id: ID!, $title: String!, $url: String, $note: String) {\n    updateProjectResource(id: $id, title: $title, url: $url, note: $note)\n  }\n"): typeof import('./graphql').UpdateProjectResourceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProjectResource($id: ID!) {\n    deleteProjectResource(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectResourceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveProjectResource($id: ID!, $index: Int!) {\n    moveProjectResource(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveProjectResourceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ImportedDocuments($clientId: ID, $projectId: ID) {\n    importedDocuments(clientId: $clientId, projectId: $projectId) {\n      id\n      type\n      number\n      issueDate\n      dueDate\n      clientId\n      clientName\n      projectId\n      title\n      totalNet\n      totalVat\n      totalGross\n      currency\n      note\n      fileUrl\n      fileName\n      settled\n      paid\n      balance\n    }\n  }\n"): typeof import('./graphql').ImportedDocumentsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ImportDocument($input: ImportedDocumentInput!, $file: File) {\n    importDocument(input: $input, file: $file)\n  }\n"): typeof import('./graphql').ImportDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateImportedDocument($id: ID!, $input: ImportedDocumentInput!, $file: File) {\n    updateImportedDocument(id: $id, input: $input, file: $file)\n  }\n"): typeof import('./graphql').UpdateImportedDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteImportedDocument($id: ID!) {\n    deleteImportedDocument(id: $id)\n  }\n"): typeof import('./graphql').DeleteImportedDocumentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DocumentStatuses {\n    documentStatuses {\n      id\n      scope\n      name\n      color\n      category\n      position\n      documentCount\n    }\n  }\n"): typeof import('./graphql').DocumentStatusesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query OverdueInvoices($today: Date!) {\n    overdueInvoices(today: $today) {\n      id\n      type\n      number\n      clientId\n      clientName\n      projectId\n      contactId\n      serviceId\n      issueDate\n      dueDate\n      totalGross\n      currency\n      balance\n      billingEmail\n      reminderCount\n      lastReminderAt\n    }\n  }\n"): typeof import('./graphql').OverdueInvoicesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendDocumentReminders($accountId: ID!, $documentIds: [ID!]!) {\n    sendDocumentReminders(accountId: $accountId, documentIds: $documentIds) {\n      documentId\n      number\n      error\n    }\n  }\n"): typeof import('./graphql').SendDocumentRemindersDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateDocumentStatus($scope: DocumentStatusScope!, $name: String!, $color: String!, $category: DocumentStatusCategory!) {\n    createDocumentStatus(scope: $scope, name: $name, color: $color, category: $category)\n  }\n"): typeof import('./graphql').CreateDocumentStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateDocumentStatus($id: ID!, $name: String, $color: String, $category: DocumentStatusCategory) {\n    updateDocumentStatus(id: $id, name: $name, color: $color, category: $category)\n  }\n"): typeof import('./graphql').UpdateDocumentStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteDocumentStatus($id: ID!) {\n    deleteDocumentStatus(id: $id)\n  }\n"): typeof import('./graphql').DeleteDocumentStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveDocumentStatus($id: ID!, $index: Int!) {\n    moveDocumentStatus(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveDocumentStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetDocumentTrackingStatus($id: ID!, $statusId: ID!) {\n    setDocumentTrackingStatus(id: $id, statusId: $statusId)\n  }\n"): typeof import('./graphql').SetDocumentTrackingStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarkDocumentSent($id: ID!) {\n    markDocumentSent(id: $id)\n  }\n"): typeof import('./graphql').MarkDocumentSentDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AcceptQuote($id: ID!, $date: Date!, $file: File) {\n    acceptQuote(id: $id, date: $date, file: $file)\n  }\n"): typeof import('./graphql').AcceptQuoteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveSignedQuote($id: ID!) {\n    removeSignedQuote(id: $id)\n  }\n"): typeof import('./graphql').RemoveSignedQuoteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddDocumentReminder($id: ID!, $note: String) {\n    addDocumentReminder(id: $id, note: $note)\n  }\n"): typeof import('./graphql').AddDocumentReminderDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteDocumentReminder($id: ID!) {\n    deleteDocumentReminder(id: $id)\n  }\n"): typeof import('./graphql').DeleteDocumentReminderDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RecordDocumentPayment($id: ID!, $input: DocumentPaymentInput!) {\n    recordDocumentPayment(id: $id, input: $input)\n  }\n"): typeof import('./graphql').RecordDocumentPaymentDocument;
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
export function graphql(source: "\n  fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {\n    key\n    eventId\n    occurrenceDate\n    modified\n    title\n    description\n    location\n    links {\n      url\n      label\n    }\n    allDay\n    startDate\n    startTime\n    endDate\n    endTime\n    timeZone\n    start\n    end\n    recurrence\n    seriesStartDate\n    reminders\n    projectId\n    contributorIds\n    categoryIds\n  }\n"): typeof import('./graphql').CalendarEventOccurrenceFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CalendarCategories {\n    calendarCategories {\n      id\n      name\n      color\n      parentId\n      position\n    }\n  }\n"): typeof import('./graphql').CalendarCategoriesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CalendarEvents($from: Date!, $to: Date!) {\n    calendarEvents(from: $from, to: $to) {\n      ...CalendarEventOccurrenceFields\n    }\n  }\n"): typeof import('./graphql').CalendarEventsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateCalendarCategory($input: CalendarCategoryInput!) {\n    createCalendarCategory(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateCalendarCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCalendarCategory($id: ID!, $input: CalendarCategoryInput!) {\n    updateCalendarCategory(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateCalendarCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteCalendarCategory($id: ID!) {\n    deleteCalendarCategory(id: $id)\n  }\n"): typeof import('./graphql').DeleteCalendarCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveCalendarCategory($id: ID!, $index: Int!) {\n    moveCalendarCategory(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveCalendarCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateCalendarEvent($input: CalendarEventInput!) {\n    createCalendarEvent(input: $input)\n  }\n"): typeof import('./graphql').CreateCalendarEventDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    updateCalendarEvent(id: $id, input: $input, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n"): typeof import('./graphql').UpdateCalendarEventDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {\n    deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)\n  }\n"): typeof import('./graphql').DeleteCalendarEventDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MaterializeTaskOccurrences($from: Date!, $to: Date!) {\n    materializeTaskOccurrences(from: $from, to: $to)\n  }\n"): typeof import('./graphql').MaterializeTaskOccurrencesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Dashboards($projectId: ID) {\n    dashboards(projectId: $projectId) {\n      id\n      projectId\n      name\n      position\n      charts {\n        id\n        dashboardId\n        title\n        config\n        wide\n        position\n      }\n    }\n  }\n"): typeof import('./graphql').DashboardsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateDashboard($name: String!, $projectId: ID) {\n    createDashboard(name: $name, projectId: $projectId)\n  }\n"): typeof import('./graphql').CreateDashboardDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RenameDashboard($id: ID!, $name: String!) {\n    renameDashboard(id: $id, name: $name)\n  }\n"): typeof import('./graphql').RenameDashboardDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteDashboard($id: ID!) {\n    deleteDashboard(id: $id)\n  }\n"): typeof import('./graphql').DeleteDashboardDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveDashboard($id: ID!, $index: Int!) {\n    moveDashboard(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveDashboardDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateDashboardChart($dashboardId: ID!, $input: DashboardChartInput!) {\n    createDashboardChart(dashboardId: $dashboardId, input: $input)\n  }\n"): typeof import('./graphql').CreateDashboardChartDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateDashboardChart($id: ID!, $input: DashboardChartInput!) {\n    updateDashboardChart(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateDashboardChartDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DuplicateDashboardChart($id: ID!) {\n    duplicateDashboardChart(id: $id)\n  }\n"): typeof import('./graphql').DuplicateDashboardChartDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteDashboardChart($id: ID!) {\n    deleteDashboardChart(id: $id)\n  }\n"): typeof import('./graphql').DeleteDashboardChartDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveDashboardChart($id: ID!, $index: Int!) {\n    moveDashboardChart(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveDashboardChartDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GithubLogin {\n    githubLogin\n  }\n"): typeof import('./graphql').GithubLoginDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GithubContributors {\n    githubContributors {\n      id\n      name\n      githubLogin\n    }\n  }\n"): typeof import('./graphql').GithubContributorsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GithubBoard($url: String!) {\n    githubBoard(url: $url) {\n      id\n      title\n      url\n      fields {\n        id\n        name\n        dataType\n        iterationCount\n        options {\n          id\n          name\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GithubBoardDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GithubProjectLink($projectId: ID!) {\n    githubProjectLink(projectId: $projectId) {\n      id\n      projectId\n      url\n      title\n      statusFieldId\n      priorityFieldId\n      iterationFieldId\n      startFieldId\n      endFieldId\n      effortFieldId\n      statusOptions\n      priorityOptions\n      repositoryName\n      pushExisting\n      enabled\n      lastSyncAt\n      lastSyncError\n      lastSyncSummary\n      linkedTaskCount\n    }\n  }\n"): typeof import('./graphql').GithubProjectLinkDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetGithubToken($token: String!) {\n    setGithubToken(token: $token)\n  }\n"): typeof import('./graphql').SetGithubTokenDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveGithubToken {\n    removeGithubToken\n  }\n"): typeof import('./graphql').RemoveGithubTokenDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveGithubLink($projectId: ID!, $input: GithubLinkInput!) {\n    saveGithubLink(projectId: $projectId, input: $input)\n  }\n"): typeof import('./graphql').SaveGithubLinkDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UnlinkGithubProject($projectId: ID!) {\n    unlinkGithubProject(projectId: $projectId)\n  }\n"): typeof import('./graphql').UnlinkGithubProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SyncGithubProject($projectId: ID!) {\n    syncGithubProject(projectId: $projectId) {\n      pulledNew\n      pushedNew\n      pulled\n      pushed\n      unlinked\n      sprints\n    }\n  }\n"): typeof import('./graphql').SyncGithubProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetContributorGithubLogin($id: ID!, $login: String) {\n    setContributorGithubLogin(id: $id, login: $login)\n  }\n"): typeof import('./graphql').SetContributorGithubLoginDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MailAccountFields on MailAccount {\n    id\n    name\n    email\n    displayName\n    imapHost\n    imapPort\n    imapSecure\n    imapUser\n    smtpHost\n    smtpPort\n    smtpSecure\n    smtpUser\n    saveSent\n    signature\n  }\n"): typeof import('./graphql').MailAccountFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MailViewFields on MailView {\n    accountId\n    folder\n    uid\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    replyTo {\n      name\n      address\n    }\n    date\n    html\n    text\n    attachments {\n      index\n      filename\n      contentType\n      size\n      inline\n    }\n    linkedProjectIds\n  }\n"): typeof import('./graphql').MailViewFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment LinkedMailFields on LinkedMail {\n    id\n    projectId\n    accountId\n    messageId\n    inReplyTo\n    references\n    subject\n    from {\n      name\n      address\n    }\n    to {\n      name\n      address\n    }\n    cc {\n      name\n      address\n    }\n    date\n    html\n    text\n    sent\n    attachments {\n      id\n      name\n      size\n      inline\n      url\n    }\n  }\n"): typeof import('./graphql').LinkedMailFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MailAccounts {\n    mailAccounts {\n      ...MailAccountFields\n    }\n  }\n"): typeof import('./graphql').MailAccountsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MailFolders($accountId: ID!) {\n    mailFolders(accountId: $accountId) {\n      path\n      name\n      specialUse\n      unseen\n      depth\n    }\n  }\n"): typeof import('./graphql').MailFoldersDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String) {\n    mailMessages(accountId: $accountId, folder: $folder, page: $page, search: $search) {\n      total\n      pageSize\n      messages {\n        uid\n        subject\n        from {\n          name\n          address\n        }\n        to {\n          name\n          address\n        }\n        date\n        seen\n        flagged\n        hasAttachments\n      }\n    }\n  }\n"): typeof import('./graphql').MailMessagesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MailMessage($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailMessage(accountId: $accountId, folder: $folder, uid: $uid) {\n      ...MailViewFields\n    }\n  }\n"): typeof import('./graphql').MailMessageDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UnreadMailCount {\n    unreadMailCount\n  }\n"): typeof import('./graphql').UnreadMailCountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProjectMails($projectId: ID!) {\n    projectMails(projectId: $projectId) {\n      ...LinkedMailFields\n    }\n  }\n"): typeof import('./graphql').ProjectMailsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TestMailAccount($input: MailAccountInput!, $id: ID) {\n    testMailAccount(input: $input, id: $id)\n  }\n"): typeof import('./graphql').TestMailAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateMailAccount($input: MailAccountInput!) {\n    createMailAccount(input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').CreateMailAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateMailAccount($id: ID!, $input: MailAccountInput!) {\n    updateMailAccount(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateMailAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetMailSignature($id: ID!, $signature: String!) {\n    setMailSignature(id: $id, signature: $signature) {\n      id\n    }\n  }\n"): typeof import('./graphql').SetMailSignatureDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteMailAccount($id: ID!) {\n    deleteMailAccount(id: $id)\n  }\n"): typeof import('./graphql').DeleteMailAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveMailAccount($id: ID!, $index: Int!) {\n    moveMailAccount(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveMailAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetMailSeen($accountId: ID!, $folder: String!, $uids: [Int!]!, $seen: Boolean!) {\n    setMailSeen(accountId: $accountId, folder: $folder, uids: $uids, seen: $seen)\n  }\n"): typeof import('./graphql').SetMailSeenDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteMails($accountId: ID!, $folder: String!, $uids: [Int!]!) {\n    deleteMails(accountId: $accountId, folder: $folder, uids: $uids)\n  }\n"): typeof import('./graphql').DeleteMailsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LinkMail($accountId: ID!, $folder: String!, $uid: Int!, $projectId: ID!) {\n    linkMail(accountId: $accountId, folder: $folder, uid: $uid, projectId: $projectId) {\n      id\n    }\n  }\n"): typeof import('./graphql').LinkMailDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UnlinkMail($id: ID!) {\n    unlinkMail(id: $id)\n  }\n"): typeof import('./graphql').UnlinkMailDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MailDraft($accountId: ID!, $folder: String!, $uid: Int!) {\n    mailDraft(accountId: $accountId, folder: $folder, uid: $uid) {\n      accountId\n      folder\n      uid\n      to {\n        address\n      }\n      cc {\n        address\n      }\n      bcc {\n        address\n      }\n      subject\n      html\n      text\n      inReplyTo\n      references\n      projectId\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n"): typeof import('./graphql').MailDraftDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveMailDraft($input: SaveMailDraftInput!) {\n    saveMailDraft(input: $input) {\n      accountId\n      folder\n      uid\n      attachments {\n        index\n        filename\n        size\n        inline\n      }\n    }\n  }\n"): typeof import('./graphql').SaveMailDraftDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteMailDraft($location: MailLocationInput!) {\n    deleteMailDraft(location: $location)\n  }\n"): typeof import('./graphql').DeleteMailDraftDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendMail($input: SendMailInput!) {\n    sendMail(input: $input)\n  }\n"): typeof import('./graphql').SendMailDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ContributorFields on Contributor {\n    id\n    name\n    handle\n    avatarUrl\n    isMe\n    projectIds\n  }\n"): typeof import('./graphql').ContributorFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SprintFields on Sprint {\n    id\n    projectId\n    name\n    goal\n    startDate\n    endDate\n  }\n"): typeof import('./graphql').SprintFieldsFragmentDoc;
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
export function graphql(source: "\n  fragment TaskFields on Task {\n    id\n    number\n    title\n    description\n    projectId\n    statusId\n    priorityId\n    typeId\n    effort\n    startDate\n    endDate\n    parentId\n    milestoneId\n    sprintId\n    position\n    archived\n    createdAt\n    updatedAt\n    assigneeIds\n    blockingIds\n    blockedByIds\n    relatedIds\n    commentCount\n    trackedSeconds\n    recurrence\n    seriesId\n    occurrenceDate\n    closed\n    closedAt\n    githubLinked\n    githubUrl\n    githubNumber\n  }\n"): typeof import('./graphql').TaskFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TaskCommentFields on TaskComment {\n    id\n    body\n    createdAt\n  }\n"): typeof import('./graphql').TaskCommentFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TasksData {\n    tasks {\n      ...TaskFields\n    }\n    contributors {\n      ...ContributorFields\n    }\n    taskStatuses {\n      ...TaskLabelFields\n      category\n    }\n    taskPriorities {\n      id\n      name\n      color\n      position\n    }\n    taskTypes {\n      id\n      name\n      color\n      position\n    }\n    milestones {\n      ...MilestoneFields\n    }\n    sprints {\n      ...SprintFields\n    }\n  }\n"): typeof import('./graphql').TasksDataDocument;
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
export function graphql(source: "\n  mutation SetTaskRecurrence($id: ID!, $recurrence: JSON) {\n    setTaskRecurrence(id: $id, recurrence: $recurrence) {\n      id\n    }\n  }\n"): typeof import('./graphql').SetTaskRecurrenceDocument;
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
export function graphql(source: "\n  mutation CreateSprint($projectId: ID!, $input: SprintInput!) {\n    createSprint(projectId: $projectId, input: $input)\n  }\n"): typeof import('./graphql').CreateSprintDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateSprint($id: ID!, $input: SprintInput!) {\n    updateSprint(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateSprintDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteSprint($id: ID!) {\n    deleteSprint(id: $id)\n  }\n"): typeof import('./graphql').DeleteSprintDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TimeEntryFields on TimeEntry {\n    id\n    projectId\n    description\n    startedAt\n    endedAt\n    pausedAt\n    pausedSeconds\n    duration\n    taskIds\n    documentId\n    documentNumber\n  }\n"): typeof import('./graphql').TimeEntryFieldsFragmentDoc;
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
export function graphql(source: "\n  fragment TreasuryEntryFields on TreasuryEntry {\n    id\n    accountId\n    accountName\n    status\n    date\n    label\n    amount\n    category\n    method\n    projectId\n    note\n    recurrence\n    allocations {\n      id\n      amount\n      documentId\n      importedDocumentId\n      documentLabel\n    }\n  }\n"): typeof import('./graphql').TreasuryEntryFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TreasuryAccounts {\n    treasuryAccounts {\n      id\n      name\n      openingBalance\n      openingDate\n      archived\n      entryCount\n      balance\n    }\n  }\n"): typeof import('./graphql').TreasuryAccountsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TreasuryEntries($from: Date!, $to: Date!, $accountId: ID) {\n    treasuryEntries(from: $from, to: $to, accountId: $accountId) {\n      ...TreasuryEntryFields\n    }\n  }\n"): typeof import('./graphql').TreasuryEntriesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ForecastEntries {\n    forecastEntries {\n      ...TreasuryEntryFields\n    }\n  }\n"): typeof import('./graphql').ForecastEntriesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TreasuryProjection($today: Date!, $from: Date!, $until: Date!) {\n    treasuryProjection(today: $today, from: $from, until: $until) {\n      balance\n      series {\n        date\n        balance\n        forecast\n      }\n      items {\n        date\n        dueDate\n        label\n        amount\n        kind\n        overdue\n        entryId\n        documentId\n        importedDocumentId\n        recurringInvoiceId\n        accountId\n      }\n    }\n  }\n"): typeof import('./graphql').TreasuryProjectionDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTreasuryAccount($input: TreasuryAccountInput!) {\n    createTreasuryAccount(input: $input)\n  }\n"): typeof import('./graphql').CreateTreasuryAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTreasuryAccount($id: ID!, $input: TreasuryAccountInput!) {\n    updateTreasuryAccount(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateTreasuryAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTreasuryAccount($id: ID!) {\n    deleteTreasuryAccount(id: $id)\n  }\n"): typeof import('./graphql').DeleteTreasuryAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTreasuryEntry($input: TreasuryEntryInput!) {\n    createTreasuryEntry(input: $input)\n  }\n"): typeof import('./graphql').CreateTreasuryEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTreasuryEntry($id: ID!, $input: TreasuryEntryInput!) {\n    updateTreasuryEntry(id: $id, input: $input)\n  }\n"): typeof import('./graphql').UpdateTreasuryEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTreasuryEntry($id: ID!) {\n    deleteTreasuryEntry(id: $id)\n  }\n"): typeof import('./graphql').DeleteTreasuryEntryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RealizeTreasuryForecast($id: ID!, $occurrence: Date!, $date: Date!, $amount: Float!) {\n    realizeTreasuryForecast(id: $id, occurrence: $occurrence, date: $date, amount: $amount)\n  }\n"): typeof import('./graphql').RealizeTreasuryForecastDocument;
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
