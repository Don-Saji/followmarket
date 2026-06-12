"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSetup = async () => {
    setLoading(true);
    try {
      // The user wants 'admin' and 'admin@123'
      // Firebase requires a valid email format, so we use admin@market.com
      const email = "admin@market.com";
      const password = "admin@123";

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Assign 'admin' role in Firestore
      await setDoc(doc(db, "users", user.uid), {
        role: "admin",
        email: email,
        createdAt: new Date().toISOString(),
      });

      setMessage("Admin created successfully! Redirecting...");
      setTimeout(() => {
        router.push("/admin");
      }, 2000);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setMessage("Admin user already exists. Please log in.");
      } else {
        setMessage("Error: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white p-4">
      <div className="max-w-md w-full border border-gray-200 dark:border-gray-800 p-8 rounded-lg text-center">
        <h1 className="text-2xl font-bold mb-4 tracking-tight">Market Setup</h1>
        <p className="mb-6 text-sm text-gray-500">
          Click the button below to bootstrap the initial admin user (admin@market.com / admin@123).
        </p>
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Admin User"}
        </button>
        {message && <p className="mt-4 text-sm font-medium">{message}</p>}
      </div>
    </div>
  );
}
