import { createBrowserRouter, useLocation } from 'react-router';
import { App } from './app';
import { AuthenticatedRoute } from './session-boundary';
import { Account } from '../features/auth/account';
import { SecuritySetup, TwoFactorChallenge } from '../features/auth/security';
import { Card } from '../design-system';
function AccountRoute() {
  const location = useLocation();
  return <Account key={location.pathname + location.search} />;
}
export function createAppRouter() {
  return createBrowserRouter([
    ...[
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
    ].map((path) => ({ path, element: <AccountRoute /> })),
    { path: '/two-factor', element: <TwoFactorChallenge /> },
    {
      element: <AuthenticatedRoute />,
      children: [
        { path: '/', element: <App /> },
        { path: '/organizations', element: <App /> },
        { path: '/organizations/:organizationId', element: <App /> },
        {
          path: '/organizations/:organizationId/documents/:documentId',
          element: <App />,
        },
        {
          path: '/organizations/:organizationId/operations/:operationId',
          element: <App />,
        },
        { path: '/accept-invitation', element: <App /> },
        { path: '/security', element: <SecuritySetup /> },
      ],
    },
    {
      path: '*',
      element: (
        <main className="session-state">
          <Card>
            <h1>Página no encontrada</h1>
            <a href="/">Volver al inicio</a>
          </Card>
        </main>
      ),
    },
  ]);
}
