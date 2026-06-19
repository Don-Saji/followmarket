"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, onSnapshot } from "firebase/firestore";

type Role = "admin" | "marketer" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Use onSnapshot instead of getDoc so we receive the role right after it's created during registration
        unsubscribeSnapshot = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.status === "suspended") {
                // If account is suspended, log out immediately
                auth.signOut();
                setUser(null);
                setRole(null);
              } else {
                setRole(userData.role as Role);
              }
            } else {
              setRole(null);
            }
            setLoading(false); // Stop loading only after the role has been evaluated
          },
          (error) => {
            console.warn("Firestore permission denied. Please update your security rules.", error.message);
            setRole(null);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
