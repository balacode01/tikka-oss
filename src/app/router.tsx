import { createBrowserRouter } from 'react-router'
import { AppShell } from '../features/app/AppShell'
import { ComingSoon } from '../features/app/ComingSoon'
import { BacklogPage } from '../features/backlog/BacklogPage'
import { ListPage } from '../features/list/ListPage'
import { AcceptInvitePage } from '../features/invites/AcceptInvitePage'
import { BoardPage } from '../features/board/BoardPage'
import { CreateProjectPage } from '../features/projects/CreateProjectPage'
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/PasswordPages'
import { LogInPage } from '../features/auth/LogInPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { HomePage } from '../features/home/HomePage'
import { CreateWorkspacePage } from '../features/onboarding/CreateWorkspacePage'
import { ProfileSettingsPage } from '../features/profile/ProfileSettingsPage'
import { HelpPage } from '../features/help/HelpPage'
import { ConsentPage } from '../features/oauth/ConsentPage'
import { LandingPage } from '../features/landing/LandingPage'
import { RequireAuth } from './RequireAuth'

// Routes from BRD §7.1. Later milestones replace the ComingSoon placeholders.
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/login', element: <LogInPage /> },
  { path: '/forgot', element: <ForgotPasswordPage /> },
  { path: '/reset', element: <ResetPasswordPage /> },
  { path: '/invite/:token', element: <AcceptInvitePage /> },
  { path: '/oauth/consent', element: <ConsentPage /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <CreateWorkspacePage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/w/:workspace/p/:key/board', element: <BoardPage /> },
      { path: '/w/:workspace/p/:key/backlog', element: <BacklogPage /> },
      { path: '/w/:workspace/p/:key/list', element: <ListPage /> },
      {
        path: '/w/:workspace/p/:key/issues/:issueKey',
        element: <ComingSoon title="Issue" milestone="M6" />,
      },
      { path: '/w/:workspace/projects/new', element: <CreateProjectPage /> },
      { path: '/settings/profile', element: <ProfileSettingsPage /> },
      { path: '/help', element: <HelpPage /> },
    ],
  },
  { path: '*', element: <ComingSoon title="Page not found" milestone="a later milestone" /> },
])
