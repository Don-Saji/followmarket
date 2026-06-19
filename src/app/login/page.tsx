"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Forgot Password States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Support 'admin' as a shorthand for 'admin@market.com'
      const loginEmail = email.toLowerCase() === "admin" ? "admin@market.com" : email;
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);

      // Fetch role & status
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === "suspended") {
          await auth.signOut();
          setError("Your account has been suspended. Please contact the administrator.");
          return;
        }

        const role = userData.role;
        if (role === "admin") {
          router.push("/admin");
        } else {
          router.push("/marketer");
        }
      } else {
        setError("User role not found.");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      // Support 'admin' as shorthand
      const targetEmail = resetEmail.toLowerCase() === "admin" ? "admin@market.com" : resetEmail;

      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          newPassword: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess("Password has been successfully updated! You can now sign in.");
      setResetEmail("");
      setNewPassword("");
    } catch (err) {
      console.error(err);
      const errorObj = err as Error;
      setResetError(errorObj.message || "Failed to update password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white p-4">
      <div className="max-w-sm w-full">
        {forgotPasswordMode ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tighter">Market Pulse</h1>
              <p className="text-sm text-gray-500 mt-2">Reset your password</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="resetEmail">
                  Email or Username
                </label>
                <input
                  id="resetEmail"
                  type="text"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="admin or email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {resetSuccess && <p className="text-green-500 text-sm font-medium">{resetSuccess}</p>}
              {resetError && <p className="text-red-500 text-sm">{resetError}</p>}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
              >
                {resetLoading ? "Updating..." : "Update Password"}
              </button>
            </form>

            <p className="text-center text-sm mt-6 text-gray-500">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordMode(false);
                  setResetError("");
                  setResetSuccess("");
                }}
                className="text-black dark:text-white underline underline-offset-4 font-medium"
              >
                Sign In
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tighter">Market Pulse</h1>
              <p className="text-sm text-gray-500 mt-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">
                  Email or Username
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="admin or email@example.com"
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setError("");
                    }}
                    className="text-xs text-gray-500 hover:text-black dark:hover:text-white underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="text-center text-sm mt-6 text-gray-500">
              Need an account? Please contact your administrator.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
