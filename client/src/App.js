import React, { useState } from 'react';
import TeacherForm from './components/TeacherForm';
import CourseForm from './components/CourseForm';
import AllocationForm from './components/AllocationForm';
import AllocationList from './components/AllocationList';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAllocationCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="App">
      <nav className="navbar navbar-dark bg-dark">
        <div className="container">
          <span className="navbar-brand mb-0 h1">University Routine Management</span>
        </div>
      </nav>
      <div className="container">
        <div className="row">
          <div className="col-md-6">
            <TeacherForm />
            <CourseForm />
          </div>
          <div className="col-md-6">
            <AllocationForm onAllocationCreated={handleAllocationCreated} />
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <AllocationList refresh={refreshTrigger} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
