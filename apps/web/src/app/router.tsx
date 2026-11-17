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
import { ClientPage } from '../features/workspace/pages/ClientPage';
import { ProjectPage } from '../features/workspace/pages/ProjectPage';
import { SettingsPage } from '../features/workspace/pages/SettingsPage';
import { ProOnly } from '../features/workspaces/pages/ProOnly';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from '../features/home/pages/HomePage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { TimePage } from '../features/time/pages/TimePage';
import { NotFoundPage } from './NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'time', element: <TimePage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'alarms', element: <AlarmsPage /> },
          { path: 'shopping', element: <ShoppingPage /> },
          { path: 'shopping/:id', element: <ShoppingListPage /> },
          { path: 'sheets', element: <SheetsPage /> },
          { path: 'sheets/:id', element: <SheetPage /> },
          { path: 'stock', element: <StockPage /> },
          { path: 'routines', element: <RoutinesPage /> },
          { path: 'mail', element: <MailPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          {
            path: 'accounting',
            element: (
              <ProOnly>
                <AccountingPage />
              </ProOnly>
            ),
          },
          {
            path: 'accounting/imported/:id',
            element: (
              <ProOnly>
                <ImportedDocumentPage />
              </ProOnly>
            ),
          },
          {
            path: 'accounting/:id',
            element: (
              <ProOnly>
                <DocumentPage />
              </ProOnly>
            ),
          },
          { path: 'treasury', element: <TreasuryPage /> },
          { path: 'dashboards', element: <DashboardsPage /> },
          { path: 'documents', element: <LibraryPage /> },
          { path: 'settings', element: <SettingsPage /> },
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
          { path: 'login', element: <LoginPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      // Reachable whether logged in or not: these pages come from email links.
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'confirm-email', element: <ConfirmEmailPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
