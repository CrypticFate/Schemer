import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import TeacherForm from "./components/TeacherForm";
import CourseForm from "./components/CourseForm";
import AllocationForm from "./components/AllocationForm";
import AllocationList from "./components/AllocationList";
import RoutineView from "./components/RoutineView";
import Login from "./components/Login";
import Signup from "./components/Signup";
import { PrivateRoute } from "./components/PrivateRoute";
import "bootstrap/dist/css/bootstrap.min.css";

function NavigationBar() {
  const { currentUser, userRole, logout } = useAuth();

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand>University Routine Management</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/routine">
              Routine
            </Nav.Link>
            {userRole === "teacher" && (
              <Nav.Link as={Link} to="/allocations">
                Allocations
              </Nav.Link>
            )}
          </Nav>
          <Nav>
            {currentUser ? (
              <>
                <span className="navbar-text me-3">
                  {currentUser.email} ({userRole})
                </span>
                <Button variant="outline-light" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Nav.Link as={Link} to="/login">
                Login with Google
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <NavigationBar />
          <Container className="mt-4">
            <Routes>
              <Route path="/" element={<Navigate to="/routine" replace />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/allocations"
                element={
                  <PrivateRoute requiredRole="teacher">
                    <div className="row">
                      <div className="col-md-6">
                        <TeacherForm />
                        <CourseForm />
                        <AllocationForm />
                      </div>
                      <div className="col-md-6">
                        <AllocationList />
                      </div>
                    </div>
                  </PrivateRoute>
                }
              />
              <Route
                path="/routine"
                element={
                  <PrivateRoute>
                    <RoutineView />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Container>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
