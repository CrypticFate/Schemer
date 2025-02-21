import React, { createContext, useState, useContext, useEffect } from "react";
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "../firebase";

// Create the context
const AuthContext = createContext({
  currentUser: null,
  userRole: null,
  signup: () => Promise,
  login: () => Promise,
  logout: () => Promise,
  googleSignIn: () => Promise,
});

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Signup function
  async function signup(email, password, role) {
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      localStorage.setItem("userRole", role);
      setUserRole(role);
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const role = localStorage.getItem("userRole");
      setUserRole(role);
    } catch (error) {
      throw error;
    }
  }

  // Logout function
  async function logout() {
    try {
      await signOut(auth);
      localStorage.removeItem("userRole");
      setUserRole(null);
    } catch (error) {
      throw error;
    }
  }

  // Google Sign In function
  async function googleSignIn(response) {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Check email domain for teacher role (you can modify this logic)
      const isTeacher = result.user.email.endsWith("@teacher.university.edu");
      const role = isTeacher ? "teacher" : "student";

      localStorage.setItem("userRole", role);
      setUserRole(role);
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Effect for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        setUserRole(localStorage.getItem("userRole"));
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    signup,
    login,
    logout,
    googleSignIn,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
