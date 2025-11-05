import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

console.log('🚀 Main.tsx loaded successfully - Site is working!');

console.log('🔧 Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - good balance
      gcTime: 1000 * 60 * 15, // 15 minutes  
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Use cached data when available
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 2, // Retry failed requests for mobile
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
