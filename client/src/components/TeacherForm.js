import React, { useState } from "react";
import { Card } from "react-bootstrap";

const TeacherForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const onSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const body = { name, email };
      const response = await fetch("http://localhost:5000/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Clear form after successful submission
        setName("");
        setEmail("");
        alert("Teacher added successfully!");
      }
    } catch (err) {
      console.error(err.message);
      alert("Error adding teacher");
    }
  };

  return (
    <div className="d-flex justify-content-center">
      <Card className="w-100" style={{ maxWidth: "600px" }}>
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
  );
};

export default TeacherForm;
