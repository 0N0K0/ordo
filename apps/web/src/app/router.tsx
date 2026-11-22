import { createBrowserRouter } from 'react-router';
import { AuthLayout } from '../features/auth/pages/AuthLayout';
import { RequireAuth, RequireGuest } from '../features/auth/pages/guards';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ProOnly } from '../features/workspaces/pages/ProOnly';
import { lazyNamed } from '../lib/lazy';
import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { AUTH_PATHS, CLIENT_ROUTE, PAGES, PROJECT_ROUTE, routeOf, TASK_AUTOMATIONS_PATH } from './pages';

// Pages are loaded when first opened, under the `Suspense` of their layout: the app starts with the layouts and the login page.
const AccountPage = lazyNamed(() => import('../features/account/pages/AccountPage'), (module) => module.AccountPage);
const AccountingPage = lazyNamed(() => import('../features/accounting/pages/AccountingPage'), (module) => module.AccountingPage);
const DocumentPage = lazyNamed(() => import('../features/accounting/pages/DocumentPage'), (module) => module.DocumentPage);
const ImportedDocumentPage = lazyNamed(() => import('../features/accounting/pages/ImportedDocumentPage'), (module) => module.ImportedDocumentPage);
const TreasuryPage = lazyNamed(() => import('../features/treasury/pages/TreasuryPage'), (module) => module.TreasuryPage);
const DashboardsPage = lazyNamed(() => import('../features/dashboards/pages/DashboardsPage'), (module) => module.DashboardsPage);
const LibraryPage = lazyNamed(() => import('../features/library/pages/LibraryPage'), (module) => module.LibraryPage);
const AlarmsPage = lazyNamed(() => import('../features/alarms/pages/AlarmsPage'), (module) => module.AlarmsPage);
const CalendarPage = lazyNamed(() => import('../features/calendar/pages/CalendarPage'), (module) => module.CalendarPage);
const MailPage = lazyNamed(() => import('../features/mail/pages/MailPage'), (module) => module.MailPage);
const ShoppingListPage = lazyNamed(() => import('../features/shopping/pages/ShoppingListPage'), (module) => module.ShoppingListPage);
const ShoppingPage = lazyNamed(() => import('../features/shopping/pages/ShoppingPage'), (module) => module.ShoppingPage);
const SheetsPage = lazyNamed(() => import('../features/sheets/pages/SheetsPage'), (module) => module.SheetsPage);
const SheetPage = lazyNamed(() => import('../features/sheets/pages/SheetPage'), (module) => module.SheetPage);
const StockPage = lazyNamed(() => import('../features/stock/pages/StockPage'), (module) => module.StockPage);
const RoutinesPage = lazyNamed(() => import('../features/routines/pages/RoutinesPage'), (module) => module.RoutinesPage);
const ConfirmEmailPage = lazyNamed(() => import('../features/auth/pages/ConfirmEmailPage'), (module) => module.ConfirmEmailPage);
const ForgotPasswordPage = lazyNamed(() => import('../features/auth/pages/ForgotPasswordPage'), (module) => module.ForgotPasswordPage);
const ResetPasswordPage = lazyNamed(() => import('../features/auth/pages/ResetPasswordPage'), (module) => module.ResetPasswordPage);
const ClientPage = lazyNamed(() => import('../features/projects/pages/ClientPage'), (module) => module.ClientPage);
const ProjectPage = lazyNamed(() => import('../features/projects/pages/ProjectPage'), (module) => module.ProjectPage);
const SettingsPage = lazyNamed(() => import('../features/projects/pages/SettingsPage'), (module) => module.SettingsPage);
const HomePage = lazyNamed(() => import('../features/home/pages/HomePage'), (module) => module.HomePage);
const TaskAutomationsPage = lazyNamed(() => import('../features/tasks/pages/TaskAutomationsPage'), (module) => module.TaskAutomationsPage);
const TasksPage = lazyNamed(() => import('../features/tasks/pages/TasksPage'), (module) => module.TasksPage);
const TimePage = lazyNamed(() => import('../features/time/pages/TimePage'), (module) => module.TimePage);

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: routeOf(PAGES.tasks.path), element: <TasksPage /> },
          { path: routeOf(TASK_AUTOMATIONS_PATH), element: <TaskAutomationsPage /> },
          { path: routeOf(PAGES.time.path), element: <TimePage /> },
          { path: routeOf(PAGES.account.path), element: <AccountPage /> },
          { path: routeOf(PAGES.alarms.path), element: <AlarmsPage /> },
          { path: routeOf(PAGES.shopping.path), element: <ShoppingPage /> },
          { path: routeOf(PAGES.shopping.path, ':id'), element: <ShoppingListPage /> },
          { path: routeOf(PAGES.sheets.path), element: <SheetsPage /> },
          { path: routeOf(PAGES.sheets.path, ':id'), element: <SheetPage /> },
          { path: routeOf(PAGES.stock.path), element: <StockPage /> },
          { path: routeOf(PAGES.routines.path), element: <RoutinesPage /> },
          { path: routeOf(PAGES.mail.path), element: <MailPage /> },
          { path: routeOf(PAGES.calendar.path), element: <CalendarPage /> },
          {
            path: routeOf(PAGES.accounting.path),
            element: (
              <ProOnly>
                <AccountingPage />
              </ProOnly>
            ),
          },
          {
            path: routeOf(PAGES.accounting.path, 'imported/:id'),
            element: (
              <ProOnly>
                <ImportedDocumentPage />
              </ProOnly>
            ),
          },
          {
            path: routeOf(PAGES.accounting.path, ':id'),
            element: (
              <ProOnly>
                <DocumentPage />
              </ProOnly>
            ),
          },
          { path: routeOf(PAGES.treasury.path), element: <TreasuryPage /> },
          { path: routeOf(PAGES.dashboards.path), element: <DashboardsPage /> },
          { path: routeOf(PAGES.documents.path), element: <LibraryPage /> },
          { path: routeOf(PAGES.settings.path), element: <SettingsPage /> },
          {
            path: routeOf(CLIENT_ROUTE),
            element: (
              <ProOnly>
                <ClientPage />
              </ProOnly>
            ),
          },
          { path: routeOf(PROJECT_ROUTE), element: <ProjectPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RequireGuest />,
        children: [
          { path: routeOf(AUTH_PATHS.login), element: <LoginPage /> },
          { path: routeOf(AUTH_PATHS.forgotPassword), element: <ForgotPasswordPage /> },
        ],
      },
      // Reachable whether logged in or not: these pages come from email links.
      { path: routeOf(AUTH_PATHS.resetPassword), element: <ResetPasswordPage /> },
      { path: routeOf(AUTH_PATHS.confirmEmail), element: <ConfirmEmailPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
