'use client';

import { useEffect } from 'react';
import { initializeAnalytics } from '@/lib/firebase';

/**
 * FirebaseProvider component
 * 
 * This component initializes Firebase Analytics on the client side
 * It's designed for use in the root layout to set up Firebase services
 * that only work in the browser environment.
 */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Analytics only on client side
    initializeAnalytics();
  }, []);

  return <>{children}</>;
}
