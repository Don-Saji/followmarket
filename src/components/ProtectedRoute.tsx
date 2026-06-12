"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "marketer")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (allowedRoles && role && !allowedRoles.includes(role)) {
        // Redirect to appropriate dashboard based on actual role
        router.push(role === "admin" ? "/admin" : "/marketer");
      }
      // Removed the immediate redirect to /login if role is null to prevent race conditions during registration
    }
  }, [user, role, loading, router, allowedRoles]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  // If user is logged in but has no role yet (or role doesn't match allowed roles)
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black flex-col gap-4 text-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black dark:border-white mb-4"></div>
        <h2 className="text-xl font-bold">Verifying your account...</h2>
        <p className="text-gray-500 max-w-sm">If you just registered, please wait a moment. If you are stuck here, please contact an administrator to assign your role.</p>
      </div>
    );
  }

  return <>{children}</>;
}
