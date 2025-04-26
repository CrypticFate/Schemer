import React, { useState } from "react";
import { Row, Col, Card } from "react-bootstrap";

const CourseForm = () => {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [creditHours, setCreditHours] = useState("");
  const [programName, setProgramName] = useState("");

  const programMap = {
    CSE: 2,
    SWE: 1,
    EEE: 3,
    ME: 2,
    IPE: 1,
    CEE: 1,
    BTM: 1,
    // ...other programs
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const body = {
        course_code: courseCode,
        course_name: courseName,
        credit_hours: parseFloat(creditHours),
        program_name: programName,
        program_value: programMap[programName] || 1, // Default to 1 if not found
      };
      const response = await fetch("http://localhost:5000/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Clear form after successful submission
        setCourseCode("");
        setCourseName("");
        setCreditHours("");
        setProgramName("");
        alert("Course added successfully!");
      }
    } catch (err) {
      console.error(err.message);
      alert("Error adding course");
    }
  };

  return (
    <div className="d-flex justify-content-center">
      <Card className="w-100" style={{ maxWidth: "800px" }}>
        <Card.Header as="h4" className="text-center bg-primary text-white">
          Add New Course
        </Card.Header>
        <Card.Body>
          <form onSubmit={onSubmitForm}>
            <Row>
              <Col md={6}>
                <div className="form-group mb-3">
                  <label className="form-label">Course Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSE 4107"
                    required
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="form-group mb-3">
                  <label className="form-label">Course Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Structured Programming"
                    required
                  />
                </div>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <div className="form-group mb-3">
                  <label className="form-label">Credit Hours</label>
                  <select
                    className="form-control"
                    value={creditHours}
                    onChange={(e) => setCreditHours(e.target.value)}
                    required
                  >
                    <option value="">Select Credit Hours</option>
                    <option value="1.5">1.5</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </Col>
              <Col md={6}>
                <div className="form-group mb-3">
                  <label className="form-label">Program</label>
                  <select
                    className="form-control"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    required
                  >
                    <option value="">Select Program</option>
                    <option value="CSE">CSE</option>
                    <option value="SWE">SWE</option>
                    <option value="EEE">EEE</option>
                    <option value="ME">ME</option>
                    <option value="IPE">IPE</option>
                    <option value="CEE">CEE</option>
                    <option value="BTM">BTM</option>
                  </select>
                </div>
              </Col>
            </Row>
            <div className="text-center mt-4">
              <button className="btn btn-primary btn-lg">Add Course</button>
            </div>
          </form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CourseForm;
