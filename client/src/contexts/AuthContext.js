import React, { createContext, useContext, useState, useEffect } from "react";
import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "../firebase";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Get admin email from environment variable
  const adminEmails = process.env.REACT_APP_ADMIN_EMAIL
    ? process.env.REACT_APP_ADMIN_EMAIL.split(",").map((email) => email.trim())
    : [];

  function login() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        // Check if the user's email is in the admin list
        setUserRole(adminEmails.includes(user.email) ? "student" : "admin");
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [adminEmails]);

  const value = {
    currentUser,
    userRole,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
