'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * FirebaseTestComponent
 * 
 * A simple test component to verify Firebase setup is working correctly.
 * This demonstrates:
 * - Using the useAuth hook to check authentication state
 * - Firebase client-side usage
 * - TypeScript integration
 */
export function FirebaseTestComponent() {
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('User signed out');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold">Firebase Status</h2>

      {loading ? (
        <p className="text-gray-600">Loading authentication state...</p>
      ) : user ? (
        <div>
          <p className="mb-2 text-green-600 font-semibold">✓ Authenticated</p>
          <p className="mb-4 text-gray-700">
            Email: <span className="font-mono font-semibold">{user.email}</span>
          </p>
          <button
            onClick={handleSignOut}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-gray-600">Not authenticated</p>
          <Link
            href="/auth/login"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="font-semibold text-gray-700 mb-2">Firebase Services Available:</h3>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>✓ Authentication (firebase/auth)</li>
          <li>✓ Firestore (firebase/firestore)</li>
          <li>✓ Storage (firebase/storage)</li>
          <li>✓ Analytics (firebase/analytics) - Client only</li>
        </ul>
      </div>
    </div>
  );
}
