import '@fontsource-variable/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { ToastViewport } from './components/Toast';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 15_000,
      retry: 1,
    },
  },
});

registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('#root container is missing');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
