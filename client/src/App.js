import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import TeacherForm from './components/TeacherForm';
import CourseForm from './components/CourseForm';
import AllocationForm from './components/AllocationForm';
import AllocationList from './components/AllocationList';
import RoutineView from './components/RoutineView';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAllocationAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Router>
      <div className="App">
        <Navbar bg="dark" variant="dark" expand="lg">
          <Container>
            <Navbar.Brand>University Routine Management</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/allocations">Allocations</Nav.Link>
                <Nav.Link as={Link} to="/routine">Routine</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        <Container className="mt-4">
          <Routes>
            {/* Redirect root to allocations */}
            <Route path="/" element={<Navigate to="/allocations" replace />} />
            
            <Route path="/allocations" element={
              <div className="row">
                <div className="col-md-6">
                  <TeacherForm />
                  <CourseForm />
                  <AllocationForm onAllocationAdded={handleAllocationAdded} />
                </div>
                <div className="col-md-6">
                  <AllocationList refreshTrigger={refreshTrigger} />
                </div>
              </div>
            } />
            <Route path="/routine" element={<RoutineView />} />
          </Routes>
        </Container>
      </div>
    </Router>
  );
}

export default App;