import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, Alert, Button } from "react-bootstrap";
import { FcGoogle } from "react-icons/fc";

const Login = () => {
  const [error, setError] = useState("");
  const { googleSignIn } = useAuth();
  const navigate = useNavigate();

  async function handleGoogleSignIn() {
    try {
      setError("");
      await googleSignIn();
      navigate("/routine");
    } catch (error) {
      setError("Failed to sign in with Google: " + error.message);
    }
  }

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh" }}
    >
      <Card style={{ maxWidth: "400px", width: "100%" }}>
        <Card.Body>
          <h2 className="text-center mb-4">Login</h2>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="text-center">
            <Button
              variant="light"
              className="w-100 d-flex align-items-center justify-content-center gap-2 border"
              onClick={handleGoogleSignIn}
              style={{ fontSize: "1.1rem" }}
            >
              <FcGoogle size={24} />
              Sign in with Google
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Login;
