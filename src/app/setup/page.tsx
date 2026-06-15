"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    try {
      let user;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } catch (authError) {
        const err = authError as { code?: string; message?: string };
        if (err.code === "auth/email-already-in-use") {
          // Admin exists in Auth. Sign in to write/overwrite role in Firestore.
          const signInCredential = await signInWithEmailAndPassword(auth, email, password);
          user = signInCredential.user;
        } else {
          throw authError;
        }
      }

      // Assign 'admin' role in Firestore
      await setDoc(doc(db, "users", user.uid), {
        role: "admin",
        email: email,
        createdAt: new Date().toISOString(),
      });

      setIsSuccess(true);
      setMessage("Admin account verified/created successfully! Redirecting...");
      setTimeout(() => {
        router.push("/admin");
      }, 2000);
    } catch (error) {
      console.error("Setup error:", error);
      const err = error as { code?: string; message?: string };
      if (err.message && err.message.toLowerCase().includes("permission")) {
        setMessage("Firestore permission denied. Please update your Firestore Security Rules in the Firebase Console to allow write access to 'users' (e.g. allow read, write: if request.auth != null;).");
      } else {
        setMessage("Error: " + (err.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white p-4">
      <div className="max-w-md w-full border border-gray-200 dark:border-gray-800 p-8 rounded-lg">
        <h1 className="text-2xl font-bold mb-2 tracking-tight text-center">Market Pulse Setup</h1>
        <p className="mb-6 text-sm text-gray-500 text-center">
          Enter the details to bootstrap or verify the initial administrator account.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Admin Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Admin Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-6"
          >
            {loading ? "Processing..." : "Create Admin User"}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm font-medium text-center ${isSuccess ? "text-green-500" : "text-red-500"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
