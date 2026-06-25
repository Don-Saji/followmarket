"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Loader2, Key, ShieldCheck, AlertCircle, Sun, Moon, Monitor, User } from "lucide-react";

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();

  // Appearance Theme State
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("system");
    }
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("theme");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      localStorage.setItem("theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  // Profile Name State
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsUpdatingName(true);
    setNameSuccess(null);
    setNameError(null);

    try {
      await updateProfile(user, { displayName: displayName.trim() });
      setNameSuccess("Name updated successfully!");
    } catch (error: any) {
      console.error("Error updating name:", error);
      setNameError(error.message || "Failed to update name.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      // 1. Re-authenticate User first
      const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update Auth Password
      await updatePassword(user, newPassword);

      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === "auth/wrong-password") {
        setPasswordError("Incorrect current password.");
      } else {
        setPasswordError(error.message || "Failed to update password. Please check your credentials.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-gray-500 mt-1">Manage your admin security password and theme preferences.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column (Forms) */}
          <div className="space-y-8 h-fit">
            {/* Profile Name Card */}
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-650 dark:text-gray-400" />
                Change Name
              </h2>
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                    required
                  />
                </div>
                {nameSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg font-semibold flex items-center gap-2 animate-none">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    {nameSuccess}
                  </div>
                )}
                {nameError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs rounded-lg font-semibold flex items-center gap-2 animate-none">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {nameError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isUpdatingName || !displayName.trim() || displayName.trim() === user?.displayName}
                  className="w-full bg-blue-600 text-white dark:bg-white dark:text-black py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 dark:hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isUpdatingName ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </form>
            </div>

            {/* Security Card */}
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-650 dark:text-gray-400" />
                Change Password
              </h2>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                    required
                  />
                </div>

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg font-semibold flex items-center gap-2 animate-none">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    {passwordSuccess}
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs rounded-lg font-semibold flex items-center gap-2 animate-none">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-blue-600 text-white dark:bg-white dark:text-black py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 dark:hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column (Theme Preferences Card) */}
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs h-fit">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sun className="w-5 h-5 text-gray-650 dark:text-gray-400" />
              Appearance Settings
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Customize the interface theme preference for the platform layout.</p>
            
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor }
              ].map(option => {
                const Icon = option.icon;
                const isSelected = theme === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleThemeChange(option.id as "light" | "dark" | "system")}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-blue-600 text-blue-600 ring-1 ring-blue-600 bg-blue-50/10 dark:border-white dark:text-white dark:ring-white dark:bg-zinc-900/60"
                        : "border-gray-200 dark:border-gray-800 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/30"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "text-blue-600 dark:text-amber-500" : ""}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
