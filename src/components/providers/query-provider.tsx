'use client';

// src/components/providers/query-provider.tsx
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IconContext } from '@phosphor-icons/react';
import { Toaster } from 'sonner';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Phosphor duotone is the Kero default icon style across the dashboard. */}
      <IconContext.Provider value={{ weight: 'duotone', size: 20, color: 'currentColor' }}>
        {children}
      </IconContext.Provider>
      <Toaster position="top-right" closeButton toastOptions={{ className: 'font-sans' }} />
    </QueryClientProvider>
  );
}
