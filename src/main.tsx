import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

console.log('🚀 Main.tsx loaded successfully - Site is working!');

console.log('🔧 Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - reasonable for mobile
      gcTime: 1000 * 60 * 5, // 5 minutes  
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Always fetch fresh on mount
      refetchOnReconnect: true, // Refetch when network reconnects (critical for mobile)
      retry: 2, // Retry failed requests (important for unstable mobile networks)
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
