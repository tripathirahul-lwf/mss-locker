import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './routes/AppRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as AxiosError)?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3000),
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
