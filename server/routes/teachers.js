const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get all teachers
router.get("/", async (req, res) => {
  try {
    const allTeachers = await pool.query(
      "SELECT * FROM teachers ORDER BY name"
    );
    res.json(allTeachers.rows);
  } catch (err) {
    console.error("Error fetching teachers:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// Add a new teacher
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const newTeacher = await pool.query(
      "INSERT INTO teachers (name, email) VALUES($1, $2) RETURNING *",
      [name, email]
    );
    res.status(201).json(newTeacher.rows[0]);
  } catch (err) {
    console.error("Error adding teacher:", err);
    if (err.code === "23505") {
      // Unique violation
      res
        .status(400)
        .json({ error: "A teacher with this email already exists" });
    } else {
      res.status(500).json({ error: "Failed to add teacher" });
    }
  }
});

// Update a teacher
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // First check if email is already taken by another teacher
    const existingTeacher = await pool.query(
      "SELECT * FROM teachers WHERE email = $1 AND teacher_id != $2",
      [email, id]
    );

    if (existingTeacher.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Email already in use by another teacher" });
    }

    const updateTeacher = await pool.query(
      "UPDATE teachers SET name = $1, email = $2 WHERE teacher_id = $3 RETURNING *",
      [name, email, id]
    );

    if (updateTeacher.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json(updateTeacher.rows[0]);
  } catch (err) {
    console.error("Error updating teacher:", err);
    res.status(500).json({ error: "Failed to update teacher" });
  }
});

// Check if teacher can be deleted
router.get("/:id/check-delete", async (req, res) => {
  try {
    const { id } = req.params;

    // First check if teacher exists
    const teacherExists = await pool.query(
      "SELECT * FROM teachers WHERE teacher_id = $1",
      [id]
    );

    if (teacherExists.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const result = await pool.query("SELECT * FROM can_delete_teacher($1)", [
      id,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error checking teacher delete status:", err);
    res.status(500).json({ error: "Failed to check teacher delete status" });
  }
});

// Delete a teacher
router.delete("/:id/delete", async (req, res) => {
  try {
    const { id } = req.params;

    // Begin transaction
    await pool.query("BEGIN");

    const result = await pool.query(
      "SELECT * FROM safely_delete_teacher($1) as deleted",
      [id]
    );

    if (!result.rows[0].deleted) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Teacher not found" });
    }

    await pool.query("COMMIT");
    res.json({
      message: "Teacher and related allocations deleted successfully",
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error deleting teacher:", err);
    res.status(500).json({ error: "Failed to delete teacher" });
  }
});

module.exports = router;
