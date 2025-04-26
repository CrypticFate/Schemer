import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Container, Card, Button, Alert } from "react-bootstrap";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      setError("");
      setLoading(true);
      await login();
      navigate("/routine");
    } catch (error) {
      setError("Failed to sign in with Google: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "50vh" }}
    >
      <div className="w-100" style={{ maxWidth: "400px" }}>
        <Card>
          <Card.Body>
            <h2 className="text-center mb-4">Login</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button className="w-100" onClick={handleLogin} disabled={loading}>
              Sign In with Google
            </Button>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
