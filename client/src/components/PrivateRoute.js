import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function PrivateRoute({ children, requiredRole }) {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" />;
  }

  if (requiredRole && userRole !== requiredRole) {
    // User's role doesn't match the required role, redirect to routine page
    return <Navigate to="/routine" />;
  }

  // Authorized, render component
  return children;
}
