import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../features/app/AppShell'
import { ComingSoon } from '../features/app/ComingSoon'
import { BoardPage } from '../features/board/BoardPage'
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/PasswordPages'
import { LogInPage } from '../features/auth/LogInPage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { HomePage } from '../features/home/HomePage'
import { CreateWorkspacePage } from '../features/onboarding/CreateWorkspacePage'
import { RequireAuth } from './RequireAuth'

// Routes from BRD §7.1. Later milestones replace the ComingSoon placeholders.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/home" replace /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/login', element: <LogInPage /> },
  { path: '/forgot', element: <ForgotPasswordPage /> },
  { path: '/reset', element: <ResetPasswordPage /> },
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
      {
        path: '/w/:workspace/p/:key/backlog',
        element: <ComingSoon title="Backlog" milestone="M7" />,
      },
      {
        path: '/w/:workspace/p/:key/issues/:issueKey',
        element: <ComingSoon title="Issue" milestone="M6" />,
      },
      {
        path: '/w/:workspace/projects/new',
        element: <ComingSoon title="Create project" milestone="M7" />,
      },
    ],
  },
  { path: '*', element: <ComingSoon title="Page not found" milestone="a later milestone" /> },
])
