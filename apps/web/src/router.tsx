import { createBrowserRouter } from 'react-router';
import { AccountPage } from './features/account/AccountPage';
import { AccountingPage } from './features/accounting/AccountingPage';
import { DocumentPage } from './features/accounting/DocumentPage';
import { TreasuryPage } from './features/treasury/TreasuryPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { LibraryPage } from './features/library/LibraryPage';
import { AlarmsPage } from './features/alarms/AlarmsPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { MailPage } from './features/mail/MailPage';
import { AuthLayout } from './features/auth/AuthLayout';
import { RequireAuth, RequireGuest } from './features/auth/guards';
import { ConfirmEmailPage } from './features/auth/pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { ClientPage } from './features/workspace/pages/ClientPage';
import { ProjectPage } from './features/workspace/pages/ProjectPage';
import { SettingsPage } from './features/workspace/pages/SettingsPage';
import { ProOnly } from './features/workspaces/ProOnly';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { TasksPage } from './pages/TasksPage';
import { TimePage } from './pages/TimePage';
import { NotFoundPage } from './pages/NotFoundPage';

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
