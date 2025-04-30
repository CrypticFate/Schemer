import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import { Card, Modal, Button, Alert, Table, Form, Spinner, Row, Col, Container } from "react-bootstrap"; // Added Form, Spinner, Row, Col
import axios from "axios";

const TeacherForm = () => {
  // State for adding new teacher
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false); // Loading state for add

  // State for teacher list and operations
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false); // Loading state for list
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // State for search input

  // State for edit operation
  const [editTeacher, setEditTeacher] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false); // Loading state for edit

  // State for delete operation
  const [deleteTeacher, setDeleteTeacher] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteWarning, setDeleteWarning] = useState("");
  const [isCheckingDelete, setIsCheckingDelete] = useState(false); // Loading state for delete check
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false); // Loading state for delete confirm

  // Fetch teachers on component mount
  useEffect(() => {
    fetchTeachers();
  }, []);

  // Fetch all teachers
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/teachers");
      setTeachers(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch teachers");
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle adding new teacher
  const onSubmitForm = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/teachers", { name, email });
      setSuccess("Teacher added successfully!");
      setName("");
      setEmail("");
      fetchTeachers();
    } catch (err) {
      setError(err.response?.data?.error || "Error adding teacher");
    }
  };

  // Handle initiating edit
  const handleEditClick = (teacher) => {
    setEditTeacher(teacher);
    setEditName(teacher.name);
    setEditEmail(teacher.email);
    setEditError("");
    setShowEditModal(true);
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    try {
      await axios.put(
        `http://localhost:5000/api/teachers/${editTeacher.teacher_id}`,
        {
          name: editName,
          email: editEmail,
        }
      );
      setShowEditModal(false);
      setSuccess("Teacher updated successfully!");
      fetchTeachers();
    } catch (err) {
      setEditError(err.response?.data?.error || "Error updating teacher");
    }
  };

  // Handle initiating delete
  const handleDeleteClick = async (teacher) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/teachers/${teacher.teacher_id}/check-delete`
      );
      if (response.data) {
        setDeleteTeacher(teacher);
        setDeleteWarning(response.data.message);
        setShowDeleteModal(true);
        setDeleteConfirm("");
        setError(""); // Clear any existing errors
      }
    } catch (err) {
      console.error("Delete check error:", err.response?.data || err.message);
      setError(
        err.response?.data?.error || "Error checking teacher delete status"
      );
      setShowDeleteModal(false);
    }
  };

  // Handle delete submission
  const handleDeleteSubmit = async () => {
    try {
      await axios.delete(
        `http://localhost:5000/api/teachers/${deleteTeacher.teacher_id}/delete`
      );
      setShowDeleteModal(false);
      setSuccess("Teacher deleted successfully!");
      fetchTeachers();
    } catch (err) {
      setError(err.response?.data?.error || "Error deleting teacher");
    }
  };
  // Filter teachers based on search term using useMemo
  const filteredTeachers = useMemo(() => {
    if (!searchTerm) {
      return teachers; // Return all if search is empty
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return Array.isArray(teachers) ? teachers.filter(teacher => // Ensure teachers is array
      teacher.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
      teacher.email?.toLowerCase().includes(lowerCaseSearchTerm)
    ) : [];
  }, [searchTerm, teachers]);


  return (
    <Container fluid mt={4}> {/* Use fluid container */}
      <Row>
        {/* Add New Teacher Form Column */}
        <Col md={4} className="mb-4 mb-md-0">
          <Card className="shadow-sm h-100">
            <Card.Header as="h4" className="text-center bg-primary text-white py-3">Add New Teacher</Card.Header>
            <Card.Body className="d-flex flex-column">
               {/* Display add-specific errors/success here if desired, or keep main ones */}
               {error && !showDeleteModal && !showEditModal && <Alert variant="danger">{error}</Alert>}
               {success && <Alert variant="success">{success}</Alert>}

               <Form onSubmit={onSubmitForm} className="d-flex flex-column flex-grow-1">
                  <div className="flex-grow-1">
                     <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Teacher Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmittingAdd} />
                     </Form.Group>
                     <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Email Address</Form.Label>
                        <Form.Control type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmittingAdd} />
                     </Form.Group>
                  </div>
                  <div className="mt-auto">
                     <Button type="submit" variant="primary" className="w-100" disabled={isSubmittingAdd}>
                        {isSubmittingAdd ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : "Add Teacher"}
                     </Button>
                  </div>
               </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Teachers List Column */}
        <Col md={8}>
          <Card className="shadow-sm h-100">
            <Card.Header as="h4" className="text-center bg-info text-white py-3">Teachers List</Card.Header>
            <Card.Body className="d-flex flex-column">
               {/* Search Bar */}
               <Form.Group className="mb-3 flex-shrink-0">
                 <Form.Control type="text" placeholder="Search by Name or Email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </Form.Group>

               {/* Conditional Rendering: Loading or Table */}
               {loading ? ( <div className="text-center p-3 flex-grow-1 d-flex align-items-center justify-content-center"><Spinner animation="border" size="sm"/>Â  Loading Teachers...</div> )
               : ( <div className="table-responsive flex-grow-1" style={{minHeight: '300px', maxHeight: 'calc(100vh - 310px)', overflowY: 'auto'}}>
                      <Table striped bordered hover size="sm" className="align-middle">
                        <thead className="table-light sticky-top">
                          <tr><th>Name</th><th>Email</th><th className="text-center">Actions</th></tr>
                        </thead>
                        <tbody>
                          {filteredTeachers.length > 0 ? (
                             filteredTeachers.map((teacher) => (
                               <tr key={teacher.teacher_id}>
                                 <td>{teacher.name}</td>
                                 <td>{teacher.email}</td>
                                 <td className="text-center">
                                   <Button variant="outline-warning" size="sm" className="me-2" onClick={() => handleEditClick(teacher)} disabled={isCheckingDelete || isSubmittingDelete}> Edit </Button>
                                   <Button variant="outline-danger" size="sm" onClick={() => handleDeleteClick(teacher)} disabled={isCheckingDelete || isSubmittingDelete}> {isCheckingDelete && deleteTeacher?.teacher_id === teacher.teacher_id ? <Spinner as="span" size="sm" animation="border"/> : 'Delete'} </Button>
                                 </td>
                               </tr> ))
                           ) : ( <tr><td colSpan="3" className="text-center text-muted fst-italic p-3">{searchTerm ? "No teachers match search." : "No teachers found."}</td></tr> )}
                        </tbody>
                      </Table>
                   </div>
                 )}
            </Card.Body>
          </Card>
        </Col>
      </Row>


      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Edit Teacher</Modal.Title></Modal.Header>
        <Modal.Body>
          {editError && <Alert variant="danger">{editError}</Alert>}
          <Form.Group className="mb-3"><Form.Label>Name</Form.Label><Form.Control type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required disabled={isSubmittingEdit}/></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required disabled={isSubmittingEdit}/></Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={isSubmittingEdit}> Cancel </Button>
          <Button variant="primary" onClick={handleEditSubmit} disabled={isSubmittingEdit}> {isSubmittingEdit ? <Spinner as="span" size="sm" animation="border"/> : 'Save Changes'} </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="text-danger">Confirm Delete</Modal.Title></Modal.Header>
        <Modal.Body>
           {/* Display general error only inside modal when it's open */}
           {error && showDeleteModal && <Alert variant="danger">{error}</Alert>}
           {deleteWarning && <Alert variant="warning">{deleteWarning}</Alert>}
           <p>Are you sure you want to delete: <strong>{deleteTeacher?.name}</strong> ({deleteTeacher?.email})?</p>
           <Form.Group>
              <Form.Label>To confirm, type the teacher's full name:</Form.Label>
              <Form.Control type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type full name" autoFocus disabled={isSubmittingDelete} />
           </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={isSubmittingDelete}> Cancel </Button>
          <Button variant="danger" onClick={handleDeleteSubmit} disabled={deleteConfirm !== deleteTeacher?.name || isSubmittingDelete}> {isSubmittingDelete ? <Spinner as="span" size="sm" animation="border"/> : 'Confirm Delete'} </Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
};

export default TeacherForm;