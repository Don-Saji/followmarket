"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Default role is 'marketer'. Admins must be promoted manually or via setup script.
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        role: "marketer",
        createdAt: new Date().toISOString(),
        status: "active", // active, suspended
      });

      router.push("/marketer");
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("permission")) {
        setError("Firestore Permissions Error: Please update your Firestore Security Rules in the Firebase Console to allow creating users. (e.g., allow read, write: if request.auth != null;)");
      } else {
        setError(err.message || "Failed to register.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tighter">market</h1>
          <p className="text-sm text-gray-500 mt-2">Create a marketer account</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="John Doe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
        
        <p className="text-center text-sm mt-6 text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-black dark:text-white underline underline-offset-4">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
