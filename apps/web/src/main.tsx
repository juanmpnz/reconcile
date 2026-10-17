import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { createAppRouter } from './app/routes';
import { configureNavigation } from './app/router';
import { SessionIdentityBoundary } from './app/session-boundary';
import { queryClient } from './app/query-client';
import './styles.css';
const router = createAppRouter();
configureNavigation((path, options) => router.navigate(path, options));
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionIdentityBoundary>
        <RouterProvider router={router} />
      </SessionIdentityBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
