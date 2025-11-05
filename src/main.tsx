import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

console.log('🚀 Main.tsx loaded successfully - Site is working!');
console.log('📱 User Agent:', navigator.userAgent);
console.log('🌐 Current URL:', window.location.href);

console.log('🔧 Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - reduced for mobile
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false, 
      refetchOnReconnect: true, // Refetch when connection restored
      retry: 1, // Single retry for faster mobile experience
      networkMode: 'online',
      placeholderData: (previousData) => previousData,
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
