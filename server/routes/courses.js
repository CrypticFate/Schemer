const router = require("express").Router();
const pool = require("../db");

// Get all courses
router.get("/", async (req, res) => {
  try {
    const allCourses = await pool.query(
      "SELECT * FROM courses ORDER BY course_code"
    );
    res.json(allCourses.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Check if a course can be deleted
router.get("/:id/check-delete", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM can_delete_course($1)", [
      id,
    ]);

    if (result.rows.length > 0) {
      res.json({
        can_delete: result.rows[0].can_delete,
        allocation_count: result.rows[0].allocation_count,
        message: result.rows[0].message,
      });
    } else {
      res.status(404).json({ error: "Course not found" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error checking course delete status" });
  }
});

// Delete a course
router.delete("/:id/delete", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM safely_delete_course($1)", [
      id,
    ]);

    if (result.rows[0].safely_delete_course) {
      res.json({ message: "Course deleted successfully" });
    } else {
      res
        .status(404)
        .json({ error: "Course not found or could not be deleted" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error deleting course" });
  }
});

// Add a new course
router.post("/", async (req, res) => {
  try {
    const {
      course_code,
      course_name,
      credit_hours,
      program_name,
      course_type,
      program_value,
    } = req.body;

    // Calculate allocation_availability based on credit_hours
    // For theory courses (3.0 credits) -> 4 slots available
    // For lab courses (1.5 credits) -> 2 slots available
    const allocation_availability = credit_hours === 3.0 ? 4 : 2;

    const newCourse = await pool.query(
      "INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability, course_type) VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        course_code,
        course_name,
        credit_hours,
        program_name,
        allocation_availability,
        course_type,
      ]
    );

    res.json(newCourse.rows[0]);
  } catch (err) {
    console.error("Course addition error:", err.message);
    res.status(500).json({ error: "Error adding course: " + err.message });
  }
});

module.exports = router;
