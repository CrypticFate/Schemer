import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, Alert, Button, Modal, Form } from "react-bootstrap";
import { FcGoogle } from "react-icons/fc";

const Login = () => {
  const [error, setError] = useState("");
  const { googleSignIn, setUserRole } = useAuth();
  const navigate = useNavigate();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState("student");
  const [googleUser, setGoogleUser] = useState(null);

  async function handleGoogleSignIn() {
    try {
      setError("");
      const result = await googleSignIn(true);
      setGoogleUser(result.user);
      setShowRoleModal(true);
    } catch (error) {
      setError("Failed to sign in with Google: " + error.message);
    }
  }

  const handleRoleSelection = () => {
    localStorage.setItem("userRole", selectedRole);
    setUserRole(selectedRole);
    setShowRoleModal(false);
    navigate("/routine");
  };

  return (
    <>
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

      {/* Role Selection Modal */}
      <Modal
        show={showRoleModal}
        onHide={() => setShowRoleModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Your Role</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Welcome {googleUser?.email}!</p>
          <Form>
            <Form.Group>
              <Form.Check
                type="radio"
                label="Student"
                name="role"
                checked={selectedRole === "student"}
                onChange={() => setSelectedRole("student")}
                className="mb-2"
              />
              <Form.Check
                type="radio"
                label="Teacher"
                name="role"
                checked={selectedRole === "teacher"}
                onChange={() => setSelectedRole("teacher")}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRoleModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRoleSelection}>
            Continue
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Login;
