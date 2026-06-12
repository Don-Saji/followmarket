# Firebase Setup Guide

This project is configured with Firebase for Next.js App Router with TypeScript.

## Configuration

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.local.example .env.local
```

Then update `.env.local` with your Firebase project credentials from the [Firebase Console](https://console.firebase.google.com/).

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Note:** These variables are prefixed with `NEXT_PUBLIC_` which means they're exposed to the browser. Only include non-sensitive data here.

## Firebase Architecture

### Core Files

- **[src/lib/firebase.ts](../firebase.ts)** - Main Firebase initialization
  - Prevents duplicate initialization with `getApps()`/`getApp()`
  - Exports: `app`, `auth`, `db`, `storage`, `initializeAnalytics()`
  - Analytics is wrapped to only initialize in browser environment (SSR-safe)

### Utilities & Hooks

- **[src/lib/hooks/useAuth.ts](../hooks/useAuth.ts)** - `useAuth()` hook
  - Returns current user and loading state
  - Usage: `const { user, loading } = useAuth();`

- **[src/lib/providers/firebase-provider.tsx](../providers/firebase-provider.tsx)** - Client-side provider
  - Initializes Firebase Analytics on mount
  - Use in root layout with `'use client'`

- **[src/lib/components/firebase-test.tsx](../components/firebase-test.tsx)** - Test component
  - Demonstrates Firebase integration
  - Shows auth state and Firebase services status

## Usage Examples

### Using Firebase Authentication

```typescript
'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function LoginForm() {
  const handleLogin = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('User logged in:', result.user);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // ... rest of component
}
```

### Using Firestore

```typescript
'use client';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function getUserData(userId: string) {
  const q = query(
    collection(db, 'users'),
    where('id', '==', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
```

### Using Storage

```typescript
'use client';

import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadFile(file: File, path: string) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
}
```

### Using the useAuth Hook

```typescript
'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return <div>Welcome, {user.email}</div>;
}
```

## Optional: Initialize Analytics in Root Layout

If you want to use Firebase Analytics, update your root layout:

```typescript
import { FirebaseProvider } from '@/lib/providers/firebase-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  );
}
```

## Features

✅ **Prevents Duplicate Initialization** - Uses `getApps()`/`getApp()`  
✅ **SSR-Safe** - Analytics only initializes in browser  
✅ **TypeScript Support** - Full type safety  
✅ **Path Aliases** - Uses `@/lib/firebase` for clean imports  
✅ **App Router Compatible** - Works with Next.js 15+ App Router  
✅ **Modular Design** - Easy to extend with more utilities  

## Security Notes

1. **NEVER** commit `.env.local` to version control
2. Keep `NEXT_PUBLIC_` variables public-safe only
3. Use Firebase Security Rules to protect your data
4. Enable authentication methods in Firebase Console
5. Set up CORS if needed for specific domains

## Troubleshooting

**"Firebase config is not defined"**
- Ensure `.env.local` is created and properly formatted
- Restart your dev server after adding env variables

**"Module not found: @/lib/firebase"**
- Verify `tsconfig.json` has correct path aliases
- Clear `.next` folder and rebuild

**Analytics not initializing**
- Analytics only works in browser (`typeof window !== 'undefined'`)
- Check that analytics is supported in your browser
- Verify Firebase project has Analytics enabled
