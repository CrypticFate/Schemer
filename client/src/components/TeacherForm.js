import React, { useState, useEffect } from "react";
import { Card, Modal, Button, Alert, Table } from "react-bootstrap";
import axios from "axios";

const TeacherForm = () => {
  // State for adding new teacher
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // State for teacher list and operations
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // State for edit operation
  const [editTeacher, setEditTeacher] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState("");

  // State for delete operation
  const [deleteTeacher, setDeleteTeacher] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteWarning, setDeleteWarning] = useState("");

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

  return (
    <div className="container mt-4">
      {/* Add New Teacher Form */}
      <Card className="mb-4">
        <Card.Header as="h4" className="text-center bg-primary text-white">
          Add New Teacher
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <form onSubmit={onSubmitForm}>
            <div className="form-group mb-3">
              <label>Teacher Name</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-3">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Add Teacher
            </button>
          </form>
        </Card.Body>
      </Card>

      {/* Teachers List */}
      <Card>
        <Card.Header as="h4" className="text-center bg-info text-white">
          Teachers List
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.teacher_id}>
                    <td>{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>
                      <Button
                        variant="warning"
                        size="sm"
                        className="me-2"
                        onClick={() => handleEditClick(teacher)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteClick(teacher)}
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

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Teacher</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && <Alert variant="danger">{editError}</Alert>}
          <div className="form-group mb-3">
            <label>Name</label>
            <input
              type="text"
              className="form-control"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="form-group mb-3">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleEditSubmit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteWarning && <Alert variant="warning">{deleteWarning}</Alert>}
          <p>
            To confirm deletion, type the teacher's name:{" "}
            <strong>{deleteTeacher?.name}</strong>
          </p>
          <input
            type="text"
            className="form-control"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type teacher's name to confirm"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSubmit}
            disabled={deleteConfirm !== deleteTeacher?.name}
          >
            Delete Teacher
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TeacherForm;
