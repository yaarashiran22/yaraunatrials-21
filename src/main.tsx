import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

console.log('🚀 Main.tsx loaded successfully - Site is working!');

console.log('🔧 Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 0,
      networkMode: 'online',
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('❌ Root element not found!');
}

createRoot(rootElement!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
