import { createBrowserRouter } from 'react-router';
import { AccountPage } from '../features/account/pages/AccountPage';
import { AccountingPage } from '../features/accounting/pages/AccountingPage';
import { DocumentPage } from '../features/accounting/pages/DocumentPage';
import { ImportedDocumentPage } from '../features/accounting/pages/ImportedDocumentPage';
import { TreasuryPage } from '../features/treasury/pages/TreasuryPage';
import { DashboardsPage } from '../features/dashboards/pages/DashboardsPage';
import { LibraryPage } from '../features/library/pages/LibraryPage';
import { AlarmsPage } from '../features/alarms/pages/AlarmsPage';
import { CalendarPage } from '../features/calendar/pages/CalendarPage';
import { MailPage } from '../features/mail/pages/MailPage';
import { ShoppingListPage } from '../features/shopping/pages/ShoppingListPage';
import { ShoppingPage } from '../features/shopping/pages/ShoppingPage';
import { SheetsPage } from '../features/sheets/pages/SheetsPage';
import { SheetPage } from '../features/sheets/pages/SheetPage';
import { StockPage } from '../features/stock/pages/StockPage';
import { RoutinesPage } from '../features/routines/pages/RoutinesPage';
import { AuthLayout } from '../features/auth/pages/AuthLayout';
import { RequireAuth, RequireGuest } from '../features/auth/pages/guards';
import { ConfirmEmailPage } from '../features/auth/pages/ConfirmEmailPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { ClientPage } from '../features/projects/pages/ClientPage';
import { ProjectPage } from '../features/projects/pages/ProjectPage';
import { SettingsPage } from '../features/projects/pages/SettingsPage';
import { ProOnly } from '../features/workspaces/pages/ProOnly';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from '../features/home/pages/HomePage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { TimePage } from '../features/time/pages/TimePage';
import { NotFoundPage } from './NotFoundPage';
import { AUTH_PATHS, PAGES, routeOf } from './pages';

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: routeOf(PAGES.tasks.path), element: <TasksPage /> },
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
            path: 'clients/:id',
            element: (
              <ProOnly>
                <ClientPage />
              </ProOnly>
            ),
          },
          { path: 'projects/:id', element: <ProjectPage /> },
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
