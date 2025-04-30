import React, { useState, useEffect, useMemo } from "react";
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
} from "react-bootstrap";
import axios from "axios";

const CourseForm = () => {
  // --- State ---
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [creditHours, setCreditHours] = useState("");
  const [programName, setProgramName] = useState("");
  const [courseType, setCourseType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState([]); // List of all courses
  const [loading, setLoading] = useState(false); // Loading state for course list
  const [deleteCourse, setDeleteCourse] = useState(null); // Course selected for deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Modal visibility
  const [deleteConfirm, setDeleteConfirm] = useState(""); // Input for delete confirmation
  const [deleteWarning, setDeleteWarning] = useState(""); // Warning message in modal
  const [searchTerm, setSearchTerm] = useState(""); // State for search input

  // Program to section mapping (used for availability calculation)
  const programMap = {
    CSE: 2, SWE: 1, EEE: 3, ME: 2, IPE: 1, CEE: 3, BTM: 1,
  };

  // --- Functions ---

  // Fetch all courses
  const fetchCourses = async () => {
    try {
      setLoading(true);
      // Use axios or fetch - using fetch as per original code
      const response = await fetch("http://localhost:5000/api/courses");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (Array.isArray(data)) {
        setCourses(data);
      } else {
        console.error("Invalid courses data received:", data);
        setCourses([]);
        setError("Invalid data format received from server");
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
      setCourses([]);
      setError("Failed to fetch courses");
    } finally {
      setLoading(false);
    }
  };

  // Automatically determine course type based on code
  useEffect(() => {
    const code = courseCode.trim();
    if (code.length > 0) {
      const lastChar = code.slice(-1);
      const lastDigit = parseInt(lastChar, 10);
      if (!isNaN(lastDigit)) {
        setCourseType(lastDigit % 2 === 0 ? "Lab" : "Theory");
      } else { setCourseType(""); }
    } else { setCourseType(""); }
  }, [courseCode]);

  // Fetch courses on initial component mount
  useEffect(() => { fetchCourses(); }, []);

  // Handle form submission for adding a new course
  const onSubmitForm = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setIsSubmitting(true);

    if (!courseCode || !courseName || !creditHours || !programName || !courseType) {
      setError("Please fill in all fields. Course Code must end in a digit.");
      setIsSubmitting(false); return;
    }

    try {
      const body = {
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        credit_hours: parseFloat(creditHours),
        program_name: programName,
        course_type: courseType,
        program_value: programMap[programName] || 1,
      };

      // Use axios or fetch - using fetch as per original
      const response = await fetch("http://localhost:5000/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (response.ok) {
        setCourseCode(""); setCourseName(""); setCreditHours("");
        setProgramName(""); setCourseType("");
        setSuccess("Course added successfully!");
        fetchCourses(); // Refresh list
      } else {
        setError(responseData.error || `Error: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError("An unexpected error occurred adding the course.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initiate delete process (check for allocations)
  const handleDeleteClick = async (course) => {
    // Reset previous warnings/state
    setDeleteWarning("");
    setDeleteConfirm("");
    setDeleteCourse(course); // Set the course to be potentially deleted
    setError(""); // Clear general errors

    // Check if the course has allocations before showing modal
    // NOTE: This requires a backend endpoint like `/api/courses/:id/check-delete`
    // If you don't have that, you might skip this check and just show the modal directly,
    // relying on the backend DELETE to fail if allocations exist.
    try {
      // Assuming an endpoint exists:
       // const checkResponse = await fetch(`http://localhost:5000/api/courses/${course.course_id}/check-delete`);
       // const checkData = await checkResponse.json();
       // if (!checkResponse.ok) {
       //    throw new Error(checkData.error || 'Failed to check delete status');
       // }
       // setDeleteWarning(checkData.message); // Show warning from backend if any

       // If no check endpoint, just show modal:
       setDeleteWarning(`Deleting course "${course.course_code}" might affect existing routines or allocations.`); // Generic warning
       setShowDeleteModal(true);

    } catch (err) {
      console.error("Delete check error:", err);
      setError(err.message || "Error checking course delete status");
      setDeleteCourse(null);
      setShowDeleteModal(false);
    }
  };


  // Confirm and execute delete
  const handleDeleteSubmit = async () => {
    if (!deleteCourse || deleteConfirm !== deleteCourse.course_code) {
        setError("Confirmation failed. Please type the course code correctly.");
        return;
    }
    setError(""); setSuccess(""); // Clear messages

    try {
      // Use axios or fetch - using fetch as per original
      const response = await fetch(
        `http://localhost:5000/api/courses/${deleteCourse.course_id}/delete`, // Assuming standard DELETE endpoint
        { method: "DELETE" }
      );

      if (response.ok) {
        setShowDeleteModal(false);
        setSuccess(`Course "${deleteCourse.course_code}" deleted successfully!`);
        setDeleteCourse(null); // Clear delete state
        fetchCourses(); // Refresh list
      } else {
        const data = await response.json();
        // Display error within the modal for context
        setError(`Delete failed: ${data.error || response.statusText}`);
        // Keep modal open to show error
      }
    } catch (err) {
      console.error("Delete submission error:", err);
      setError("An unexpected error occurred during deletion.");
      // Keep modal open
    }
  };

  // Filter courses based on search term (using useMemo)
  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return courses; // No search term, return all
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return courses.filter(course =>
      course.course_code?.toLowerCase().includes(lowerCaseSearchTerm) ||
      course.course_name?.toLowerCase().includes(lowerCaseSearchTerm) ||
      course.program?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [searchTerm, courses]);


  // --- Render Logic ---
  return (
    <Row className="mt-4"> {/* Use Row for overall layout */}
      {/* Form Column */}
      <Col md={5} className="mb-4 mb-md-0">
        <Card className="h-100 shadow-sm">
          <Card.Header as="h4" className="text-center bg-primary text-white py-3">Add New Course</Card.Header>
          <Card.Body className="d-flex flex-column">
            {/* Display Add/Delete Errors/Success Messages */}
            {error && !showDeleteModal && <Alert variant="danger">{error}</Alert>} {/* Hide general error when modal open */}
            {success && <Alert variant="success">{success}</Alert>}

            <Form onSubmit={onSubmitForm} className="d-flex flex-column flex-grow-1">
              <div className="flex-grow-1">
                  <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label className="fw-bold">Course Code</Form.Label><Form.Control type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CSE 1101 (Odd=T, Even=L)" required disabled={isSubmitting}/></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label className="fw-bold">Course Name</Form.Label><Form.Control type="text" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g. Intro to Programming" required disabled={isSubmitting}/></Form.Group></Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label className="fw-bold">Credit Hours</Form.Label><Form.Select value={creditHours} onChange={(e) => setCreditHours(e.target.value)} required disabled={isSubmitting} aria-label="Select Credit Hours"><option value="">Select Credit</option><option value="1.5">1.5</option><option value="3.0">3.0</option></Form.Select></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label className="fw-bold">Program</Form.Label><Form.Select value={programName} onChange={(e) => setProgramName(e.target.value)} required disabled={isSubmitting} aria-label="Select Program"><option value="">Select Program</option>{Object.keys(programMap).map((prog) => (<option key={prog} value={prog}>{prog}</option>))}</Form.Select></Form.Group></Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label className="fw-bold">Course Type</Form.Label><Form.Control type="text" value={courseType || "Auto (Theory/Lab)"} readOnly disabled className="bg-light text-muted"/></Form.Group></Col>
                    <Col md={6}></Col>
                  </Row>
              </div>
              <div className="text-center mt-auto pt-3"> {/* Push button to bottom */}
                <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-100">
                  {isSubmitting ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : "Add Course"}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Col>

      {/* List Column */}
      <Col md={7}>
        <Card className="h-100 shadow-sm">
          <Card.Header as="h4" className="text-center bg-info text-white py-3">Courses List</Card.Header>
          <Card.Body className="d-flex flex-column"> {/* Use flex for layout */}
             <Form.Group className="mb-3 flex-shrink-0"> {/* Prevent search from shrinking */}
                 <Form.Control type="text" placeholder="Search by Code, Name, or Program..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </Form.Group>

            {loading ? ( <div className="text-center p-3 flex-grow-1 d-flex align-items-center justify-content-center"><Spinner animation="border" size="sm"/>  Loading Courses...</div> )
            : (
              <div className="table-responsive flex-grow-1" style={{minHeight: '300px', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto'}}> {/* Scrollable Table, adjust maxHeight */}
                  <Table striped bordered hover size="sm" className="align-middle">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>Code</th><th>Name</th><th>Program</th><th>Type</th><th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.length > 0 ? (
                         filteredCourses.map((course) => (
                           <tr key={course.course_id}>
                             <td>{course.course_code}</td>
                             <td>{course.course_name}</td>
                             <td>{course.program}</td>
                             <td className="text-center">
                               <Badge pill bg={course.course_type === "Lab" ? "primary" : "success"}>
                                 {course.course_type}
                               </Badge>
                             </td>
                             <td className="text-center">
                               <Button variant="danger" size="sm" onClick={() => handleDeleteClick(course)} >
                                 Delete
                               </Button>
                             </td>
                           </tr> ))
                      ) : ( <tr><td colSpan="5" className="text-center text-muted fst-italic p-3">{searchTerm ? "No courses match search." : "No courses available."}</td></tr> )}
                    </tbody>
                  </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Confirm Course Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Display delete-specific error inside modal */}
          {error && showDeleteModal && <Alert variant="danger">{error}</Alert>}
          {deleteWarning && <Alert variant="warning">{deleteWarning}</Alert>}
          <p>
             Are you absolutely sure you want to delete the course: <br />
             <strong>{deleteCourse?.course_code} - {deleteCourse?.course_name}</strong>?
          </p>
          <p className="text-danger">This action cannot be undone.</p>
          <Form.Group>
              <Form.Label>To confirm, please type the course code (<strong>{deleteCourse?.course_code}</strong>) below:</Form.Label>
              <Form.Control
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type course code here"
                autoFocus
              />
          </Form.Group>

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSubmit}
            disabled={deleteConfirm !== deleteCourse?.course_code} // Enable only if code matches
          >
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Row>
  );
};

export default CourseForm;