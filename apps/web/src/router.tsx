import { createBrowserRouter } from 'react-router';
import { AccountPage } from './features/account/AccountPage';
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
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'alarms', element: <AlarmsPage /> },
          { path: 'mail', element: <MailPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'clients/:id', element: <ClientPage /> },
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
