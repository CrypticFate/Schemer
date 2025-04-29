import React, { useState, useEffect } from "react"; // Import useEffect
import { Row, Col, Card, Form, Button, Badge } from "react-bootstrap"; // Import Button, Badge

const CourseForm = () => {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [creditHours, setCreditHours] = useState("");
  const [programName, setProgramName] = useState("");
  const [courseType, setCourseType] = useState(""); // State still needed, but managed automatically
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const programMap = {
    CSE: 2, SWE: 1, EEE: 3, ME: 2, IPE: 1, CEE: 3, BTM: 1,
  };

  // --- useEffect to automatically set Course Type ---
  useEffect(() => {
    const code = courseCode.trim();
    if (code.length > 0) {
      const lastChar = code.slice(-1); // Get the last character
      const lastDigit = parseInt(lastChar, 10); // Try to parse it as a number

      if (!isNaN(lastDigit)) { // Check if it's a valid number
        if (lastDigit % 2 === 0) {
          setCourseType("Lab"); // Even -> Lab
        } else {
          setCourseType("Theory"); // Odd -> Theory
        }
      } else {
        setCourseType(""); // Last char is not a digit, reset type
      }
    } else {
      setCourseType(""); // Code is empty, reset type
    }
  }, [courseCode]); // Re-run whenever courseCode changes

  // Handle form submission
  const onSubmitForm = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    // --- Validation ---
    // Check basic fields first
    if (!courseCode || !courseName || !creditHours || !programName) {
        setError("Please fill in Course Code, Name, Credit Hours, and Program.");
        setIsSubmitting(false);
        return;
    }
    // Check if courseType was automatically determined (implies valid course code ending)
     if (!courseType) {
         setError("Course Code must end in a digit to determine Course Type (Odd=Theory, Even=Lab).");
         setIsSubmitting(false);
         return;
     }

    try {
      const body = {
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        credit_hours: parseFloat(creditHours),
        program_name: programName,
        course_type: courseType, // Use the automatically determined type
        program_value: programMap[programName] || 1,
      };

      const response = await fetch("http://localhost:5000/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (response.ok) {
        setCourseCode(""); setCourseName(""); setCreditHours("");
        setProgramName(""); setCourseType(""); // Clear type state as well
        setSuccess("Course added successfully!");
      } else {
         setError(responseData.error || `Error adding course: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center mt-4">
      <Card className="w-100" style={{ maxWidth: "800px" }}>
        <Card.Header as="h4" className="text-center bg-primary text-white">
          Add New Course
        </Card.Header>
        <Card.Body>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={onSubmitForm}>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group> {/* Use Form.Group for consistency */}
                  <Form.Label className="fw-bold">Course Code</Form.Label>
                  <Form.Control // Use Form.Control
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSE 1101 (Odd=Theory, Even=Lab)" // Hint in placeholder
                    required
                    disabled={isSubmitting}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Course Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Introduction to Programming"
                    required
                    disabled={isSubmitting}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Credit Hours</Form.Label>
                  <Form.Select
                    value={creditHours}
                    onChange={(e) => setCreditHours(e.target.value)}
                    required
                    disabled={isSubmitting}
                    aria-label="Select Credit Hours"
                  >
                    <option value="">Select Credit Hours</option>
                    <option value="1.5">1.5</option>
                    <option value="3.0">3.0</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Program</Form.Label>
                   <Form.Select
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    required
                    disabled={isSubmitting}
                    aria-label="Select Program"
                  >
                    <option value="">Select Program</option>
                    {Object.keys(programMap).map(prog => (
                       <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {/* --- Display Auto-Determined Course Type --- */}
            <Row className="mb-3">
              <Col md={6}>
                 <Form.Group>
                     <Form.Label className="fw-bold">Course Type </Form.Label>
                     <Form.Control
                         type="text"
                         value={courseType || 'Theory or Lab'} // Show determined type or placeholder
                         readOnly
                         disabled // Visually disable it
                         className="bg-light" // Style as read-only
                     />
                      {/* Optional: Badge for visual confirmation */}
                     
                 </Form.Group>
              </Col>
              <Col md={6}>
                 {/* Empty column */}
              </Col>
            </Row>
            {/* --- End Course Type Display --- */}

            <div className="text-center mt-4">
              {/* Use React-Bootstrap Button */}
              <Button
                type="submit"
                variant="primary" // Use variant prop
                size="lg" // Use size prop
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Course"}
              </Button>
            </div>
          </form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CourseForm;