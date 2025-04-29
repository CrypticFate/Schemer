import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, Modal, Button } from "react-bootstrap";

const TeacherForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [selectedEditTeacherId, setSelectedEditTeacherId] = useState("");
  const [selectedDeleteTeacherId, setSelectedDeleteTeacherId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmDelName, setConfirmDelName] = useState("");
  const [deleteName, setDeleteName] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");


  const onSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5000/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      if (response.ok) {
        setName("");
        setEmail("");
        alert("Teacher added successfully!");
        fetchTeachers();
      }
    } catch (err) {
      console.error(err.message);
      alert("Error adding teacher");
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/teachers");
      setTeachers(res.data);
    } catch (err) {
      console.error("Error fetching teachers", err);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    const teacher = teachers.find(t => t.teacher_id === parseInt(selectedEditTeacherId));
    if (teacher) {
      setEditName(teacher.name);
      setEditEmail(teacher.email);
    }
  }, [selectedEditTeacherId, teachers]);

  useEffect(() => {
    const teacher = teachers.find(t => t.teacher_id === parseInt(selectedDeleteTeacherId));
    if (teacher) {
      setDeleteName(teacher.name);
      setDeleteEmail(teacher.email);
    } else {
      setDeleteName("");
      setDeleteEmail("");
    }
  }, [selectedDeleteTeacherId, teachers]);
  

  const handleEditSubmit = async () => {
    try {
      if (!editName.trim() || !editEmail.trim()) {
        alert("Name and Email are required");
        return;
      }

      if (!/\S+@\S+\.\S+/.test(editEmail)) {
        alert("Please enter a valid email address");
        return;
      }

      const updateData = { name: editName, email: editEmail };
      const response = await axios.put(`http://localhost:5000/api/teachers/${selectedEditTeacherId}`, updateData);

      if (response.status === 200) {
        alert("Teacher updated successfully!");
        setShowEditConfirm(false);
        setSelectedEditTeacherId("");
        setEditName("");
        setEditEmail("");
        fetchTeachers();
      }
    } catch (err) {
      console.error("Error updating teacher:", err);
      alert("Failed to update teacher");
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      const response = await axios.delete(`http://localhost:5000/api/teachers/${selectedDeleteTeacherId}/delete`);
      if (response.status === 200) {
        alert("Teacher deleted successfully, along with all allocations.");
        setSelectedDeleteTeacherId("");
        setConfirmDelName("");
        setShowDeleteConfirm(false);
        fetchTeachers();
      }
    } catch (err) {
      console.error("Error deleting teacher:", err);
      alert("Failed to delete teacher");
    }
  };

  return (
    <div className="d-flex flex-column align-items-center">
      {/* Add New Teacher */}
      <div className="mb-5 w-100" style={{ maxWidth: "600px" }}>
        <Card>
          <Card.Header as="h4" className="text-center bg-primary text-white">
            Add New Teacher
          </Card.Header>
          <Card.Body>
            <form onSubmit={onSubmitForm}>
              <div className="form-group mb-4">
                <label className="form-label">Teacher Name</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter teacher's full name"
                  required
                />
              </div>
              <div className="form-group mb-4">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control form-control-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter teacher's email"
                  required
                />
              </div>
              <div className="text-center">
                <button className="btn btn-primary btn-lg">Add Teacher</button>
              </div>
            </form>
          </Card.Body>
        </Card>
      </div>

      {/* Edit Teacher */}
      <div className="mb-5 w-100" style={{ maxWidth: "600px" }}>
        <Card>
          <Card.Header as="h4" className="text-center bg-warning text-dark">
            Edit Teacher
          </Card.Header>
          <Card.Body>
            <div className="form-group mb-3">
              <label>Select Teacher</label>
              <select
                className="form-control"
                value={selectedEditTeacherId}
                onChange={(e) => setSelectedEditTeacherId(e.target.value)}
              >
                <option value="">Select a teacher</option>
                {teachers.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.name} (ID: {t.teacher_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Teacher Name</label>
              <input
                type="text"
                className="form-control form-control-lg"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Teacher Name"
              />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Teacher Email</label>
              <input
                type="email"
                className="form-control form-control-lg"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Teacher Email"
              />
            </div>

            <div className="text-center">
              <button
                className="btn btn-warning btn-lg"
                onClick={() => setShowEditConfirm(true)}
                disabled={!selectedEditTeacherId || !editName.trim() || !editEmail.trim()}
              >
                Confirm Edit
              </button>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Delete Teacher */}
      <div className="mb-5 w-100" style={{ maxWidth: "600px" }}>
        <Card>
          <Card.Header as="h4" className="text-center bg-danger text-white">
            Delete Teacher
          </Card.Header>
          <Card.Body>
            <div className="form-group mb-3">
              <label>Select Teacher</label>
              <select
                className="form-control"
                value={selectedDeleteTeacherId}
                onChange={(e) => setSelectedDeleteTeacherId(e.target.value)}
              >
                <option value="">Select a teacher</option>
                {teachers.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.name} (ID: {t.teacher_id})
                  </option>
                ))}
              </select>
            </div>
            {selectedDeleteTeacherId && (
              <div className="mb-4 p-3 border rounded">
                <p><strong>Name:</strong> {deleteName}</p>
                <p><strong>Email:</strong> {deleteEmail}</p>
                <p className="text-danger">
                  Warning: Deleting a teacher will also remove all their allocations.
                </p>
              </div>
            )}
            <div className="text-center">
              <button
                className="btn btn-danger btn-lg"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!selectedDeleteTeacherId}
              >
                Delete Teacher
              </button>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Edit Confirmation Modal */}
      <Modal show={showEditConfirm} onHide={() => setShowEditConfirm(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Confirm Edit</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to save these changes?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
          <Button variant="warning" onClick={handleEditSubmit}>Yes, Edit</Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Type the teacher's name to confirm deletion:</p>
          <input
            type="text"
            className="form-control"
            value={confirmDelName}
            onChange={(e) => setConfirmDelName(e.target.value)}
            placeholder="Confirm Teacher Name"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleDeleteSubmit}
            disabled={teachers.find(t => t.teacher_id === parseInt(selectedDeleteTeacherId))?.name !== confirmDelName}
          >
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TeacherForm;
