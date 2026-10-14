import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { readinessSchema } from '@reconcile/contracts';
import './styles.css';
const client = new QueryClient();
function App() {
  const health = useQuery({
    queryKey: ['platform', 'readiness'],
    queryFn: async () => {
      const response = await fetch('/api/v1/health/ready', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok && response.status !== 503)
        throw new Error('No se pudo consultar la API');
      return readinessSchema.parse(await response.json());
    },
    retry: 1,
    refetchInterval: 15000,
  });
  const label = health.isPending
    ? 'Comprobando servicios…'
    : health.isError
      ? 'API no disponible'
      : health.data.status === 'ready'
        ? 'Servicios disponibles'
        : 'Hay servicios pendientes';
  return (
    <main>
      <header>
        <span className="wordmark">
          reconcile<span>.</span>
        </span>
        <span className="byline">KERSHELL</span>
      </header>
      <section>
        <p className="eyebrow">BASE DEL PRODUCTO · FASE 0</p>
        <h1>
          Cada diferencia,
          <br />
          con su evidencia.
        </h1>
        <p className="intro">
          Cotejo de documentos y costes de proveedores. Núcleo común, reglas por
          sector y primer piloto logístico.
        </p>
        <aside aria-label="Estado de la plataforma">
          <h2 aria-live="polite">{label}</h2>
          {health.data && (
            <dl>
              {Object.entries(health.data.checks).map(([service, state]) => (
                <div key={service}>
                  <dt>{service}</dt>
                  <dd>{state === 'up' ? 'Disponible' : 'No disponible'}</dd>
                </div>
              ))}
            </dl>
          )}
          <button
            onClick={() => {
              void health.refetch();
            }}
            disabled={health.isFetching}
          >
            Volver a comprobar
          </button>
        </aside>
        <p className="note">
          La carga de facturas, autenticación y análisis se implementarán en las
          siguientes fases. Esta pantalla muestra conectividad real.
        </p>
      </section>
    </main>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
