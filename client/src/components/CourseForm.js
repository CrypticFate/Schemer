import React, { useState, useEffect } from "react"; // Import useEffect
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Alert,
  Table,
  Modal,
  Spinner,
} from "react-bootstrap"; // Import Modal, Spinner

const CourseForm = () => {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [creditHours, setCreditHours] = useState("");
  const [programName, setProgramName] = useState("");
  const [courseType, setCourseType] = useState(""); // State still needed, but managed automatically
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New state for courses list and delete operation
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteCourse, setDeleteCourse] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteWarning, setDeleteWarning] = useState("");

  const programMap = {
    CSE: 2,
    SWE: 1,
    EEE: 3,
    ME: 2,
    IPE: 1,
    CEE: 3,
    BTM: 1,
  };

  // Fetch courses on component mount
  useEffect(() => {
    fetchCourses();
  }, []);

  // Fetch all courses
  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/courses");
      const data = await response.json();
      setCourses(data);
      setError("");
    } catch (err) {
      setError("Failed to fetch courses");
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- useEffect to automatically set Course Type ---
  useEffect(() => {
    const code = courseCode.trim();
    if (code.length > 0) {
      const lastChar = code.slice(-1); // Get the last character
      const lastDigit = parseInt(lastChar, 10); // Try to parse it as a number

      if (!isNaN(lastDigit)) {
        // Check if it's a valid number
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
      setError(
        "Course Code must end in a digit to determine Course Type (Odd=Theory, Even=Lab)."
      );
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
        setCourseCode("");
        setCourseName("");
        setCreditHours("");
        setProgramName("");
        setCourseType(""); // Clear type state as well
        setSuccess("Course added successfully!");
        fetchCourses(); // Refresh the courses list
      } else {
        setError(
          responseData.error || `Error adding course: ${response.statusText}`
        );
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle initiating delete
  const handleDeleteClick = async (course) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/courses/${course.course_id}/check-delete`
      );
      const data = await response.json();
      if (response.ok) {
        setDeleteCourse(course);
        setDeleteWarning(data.message);
        setShowDeleteModal(true);
        setDeleteConfirm("");
        setError("");
      }
    } catch (err) {
      console.error("Delete check error:", err);
      setError(
        err.response?.data?.error || "Error checking course delete status"
      );
      setShowDeleteModal(false);
    }
  };

  // Handle delete submission
  const handleDeleteSubmit = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/courses/${deleteCourse.course_id}/delete`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setShowDeleteModal(false);
        setSuccess("Course deleted successfully!");
        fetchCourses(); // Refresh the courses list
      } else {
        const data = await response.json();
        setError(data.error || "Error deleting course");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error deleting course");
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
                <Form.Group>
                  {" "}
                  {/* Use Form.Group for consistency */}
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
                    {Object.keys(programMap).map((prog) => (
                      <option key={prog} value={prog}>
                        {prog}
                      </option>
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
                    value={courseType || "Theory or Lab"} // Show determined type or placeholder
                    readOnly
                    disabled // Visually disable it
                    className="bg-light" // Style as read-only
                  />
                  {/* Optional: Badge for visual confirmation */}
                </Form.Group>
              </Col>
              <Col md={6}>{/* Empty column */}</Col>
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

      {/* Courses List Card */}
      <Card className="w-100 mt-4" style={{ maxWidth: "800px" }}>
        <Card.Header as="h4" className="text-center bg-info text-white">
          Courses List
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Program</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.course_id}>
                    <td>{course.course_code}</td>
                    <td>{course.course_name}</td>
                    <td>{course.program_name}</td>
                    <td>
                      <Badge
                        bg={
                          course.course_type === "Lab" ? "primary" : "success"
                        }
                      >
                        {course.course_type}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteClick(course)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteWarning && <Alert variant="warning">{deleteWarning}</Alert>}
          <p>
            To confirm deletion, type the course code:{" "}
            <strong>{deleteCourse?.course_code}</strong>
          </p>
          <input
            type="text"
            className="form-control"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type course code to confirm"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSubmit}
            disabled={deleteConfirm !== deleteCourse?.course_code}
          >
            Delete Course
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CourseForm;
