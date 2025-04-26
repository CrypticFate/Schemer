const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");

// middleware
app.use(cors());
app.use(express.json());

// Routes

// Days routes
app.get("/api/days", async (req, res) => {
  try {
    const allDays = await pool.query("SELECT * FROM days ORDER BY day_order");
    res.json(allDays.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Time slots routes
app.get("/api/time-slots", async (req, res) => {
  try {
    const allTimeSlots = await pool.query(
      "SELECT * FROM time_slots ORDER BY slot_order"
    );
    res.json(allTimeSlots.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route to fetch teacher name by course_id
app.get("/api/get-teacher-by-course/:course_id", async (req, res) => {
  const { course_id } = req.params;

  try {
    // Query to fetch the teacher_id from the allocations table for the given course_id
    const allocation = await pool.query(
      `SELECT teacher_id FROM allocations WHERE course_id = $1 LIMIT 1`,
      [course_id]
    );

    if (allocation.rows.length === 0) {
      return res.json({ teacher_name: null }); // No allocation exists for this course
    }

    const teacher_id = allocation.rows[0].teacher_id;

    // Query to fetch the teacher name from the teachers table
    const teacher = await pool.query(
      `SELECT name FROM teachers WHERE teacher_id = $1`,
      [teacher_id]
    );

    if (teacher.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ teacher_name: teacher.rows[0].name });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Allocation Availability route from Course table
app.get("/api/get-availability-by-course/:course_id", async (req, res) => {
  const { course_id } = req.params;

  try {
    // Query to fetch the allocation_availability from the courses table for the given course_id
    const course = await pool.query(
      `SELECT allocation_availability FROM courses WHERE course_id = $1 LIMIT 1`,
      [course_id]
    );

    if (course.rows.length === 0) {
      return res.json({ allocation_availability: null }); // No course exists with this ID
    }

    const allocationAvailability = course.rows[0].allocation_availability;

    res.json({ allocation_availability: allocationAvailability });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Room availability routes
app.get("/api/room-availability", async (req, res) => {
  try {
    const { day_id, slot_id } = req.query;

    // Validate input parameters
    if (!day_id || !slot_id) {
      return res.status(400).json({
        error: "Both day_id and slot_id are required parameters",
      });
    }

    // Convert to integers
    const dayId = parseInt(day_id);
    const slotId = parseInt(slot_id);

    if (isNaN(dayId) || isNaN(slotId)) {
      return res.status(400).json({
        error: "day_id and slot_id must be valid numbers",
      });
    }

    // Get available rooms
    const availableRooms = await pool.query(
      "SELECT * FROM get_available_rooms($1, $2)",
      [dayId, slotId]
    );

    // Return empty array if no rooms available
    res.json(availableRooms.rows || []);
  } catch (err) {
    console.error("Error in /api/room-availability:", err.message);

    // Check for specific database errors
    if (
      err.message.includes("Invalid day_id") ||
      err.message.includes("Invalid slot_id")
    ) {
      return res.status(400).json({
        error: err.message,
      });
    }

    res.status(500).json({
      error: "Error fetching available rooms",
      details: err.message,
    });
  }
});

// Teachers routes
app.get("/api/teachers", async (req, res) => {
  try {
    const allTeachers = await pool.query(
      "SELECT * FROM teachers ORDER BY name"
    );
    res.json(allTeachers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create teacher
app.post("/api/teachers", async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        error: "Both name and email are required",
      });
    }

    const newTeacher = await pool.query(
      "INSERT INTO teachers (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );

    res.json(newTeacher.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === "23505") {
      res.status(400).json({
        error: "A teacher with this email already exists",
      });
    } else {
      res.status(500).json({
        error: "Error creating teacher",
        details: err.message,
      });
    }
  }
});

// Get teacher's schedule
app.get("/api/teachers/:teacherId/schedule", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schedule = await pool.query(
      "SELECT * FROM get_teacher_schedule($1)",
      [teacherId]
    );
    res.json(schedule.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Courses routes
app.get("/api/courses", async (req, res) => {
  try {
    const allCourses = await pool.query(
      "SELECT * FROM courses ORDER BY course_code"
    );
    res.json(allCourses.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get course by ID
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const course = await pool.query(
      "SELECT * FROM courses WHERE course_id = $1",
      [id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(course.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create course
app.post("/api/courses", async (req, res) => {
  const client = await pool.connect(); // Get a client from the pool

  try {
    await client.query("BEGIN"); // Start transaction

    const {
      course_code,
      course_name,
      credit_hours,
      program_value,
      program_name,
    } = req.body;

    // Validate required fields
    if (!course_code) {
      throw new Error("Course code required");
    }
    if (!course_name) {
      throw new Error("Course name required");
    }
    if (!credit_hours) {
      throw new Error("Credit hours required");
    }
    if (!program_name) {
      throw new Error("Program name required");
    }

    // Validate credit hours
    if (credit_hours <= 0) {
      throw new Error("Credit hours must be greater than 0");
    }

    const allocationAvailability =
      (credit_hours === 1.5 ? 1 : credit_hours === 3 ? 2 : null) *
      program_value;

    if (allocationAvailability === null) {
      throw new Error(
        "Invalid credit hours provided. Only 1.5 and 3 are allowed."
      );
    }

    const newCourse = await client.query(
      `INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        course_code,
        course_name,
        credit_hours,
        program_name,
        allocationAvailability,
      ]
    );

    await client.query("COMMIT");
    res.json(newCourse.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    if (err.code === "23505") {
      res.status(400).json({
        error: "A course with this code already exists",
      });
    } else {
      res.status(500).json({
        error: "Error creating course",
        details: err.message,
      });
    }
  } finally {
    client.release();
  }
});

// Rooms routes
app.get("/api/rooms", async (req, res) => {
  try {
    const allRooms = await pool.query(
      "SELECT * FROM rooms ORDER BY room_number"
    );
    res.json(allRooms.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add these validation functions before the allocations POST route
const validateTeacherConstraints = async (client, teacher_id, day_id) => {
  // Check consecutive hours
  const teacherSlots = await client.query(
    `SELECT ts.slot_order 
     FROM allocations a
     JOIN time_slots ts ON a.slot_id = ts.slot_id
     WHERE a.teacher_id = $1 AND a.day_id = $2
     ORDER BY ts.slot_order`,
    [teacher_id, day_id]
  );

  if (teacherSlots.rows.length >= 3) {
    throw new Error(
      "Teacher cannot be allocated more than 3 consecutive time slots in a day"
    );
  }
};

const validateRoomConstraints = async (client, room_id, program, section) => {
  // Check room capacity against section size
  const room = await client.query(
    "SELECT capacity FROM rooms WHERE room_id = $1",
    [room_id]
  );

  const expectedSize =
    program === "CSE"
      ? 60
      : program === "EEE"
      ? 55
      : program === "ME"
      ? 50
      : 40;

  if (room.rows[0].capacity < expectedSize) {
    throw new Error(
      `Room capacity (${room.rows[0].capacity}) is insufficient for ${program} section ${section} (requires ${expectedSize} seats)`
    );
  }
};

// Allocations routes (creating new allocations)
app.post("/api/allocations", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      teacher_id,
      course_id,
      room_id,
      day_id,
      slot_id,
      program,
      section,
    } = req.body;

    // Validate required fields
    if (
      !teacher_id ||
      !course_id ||
      !room_id ||
      !day_id ||
      !slot_id ||
      !program ||
      !section
    ) {
      throw new Error(
        "All fields are required (teacher_id, course_id, room_id, day_id, slot_id, program, section)"
      );
    }

    // Check if room is available
    const availableRooms = await client.query(
      "SELECT * FROM get_available_rooms($1, $2) WHERE room_id = $3",
      [day_id, slot_id, room_id]
    );

    if (availableRooms.rows.length === 0) {
      throw new Error("Selected room is not available for this time slot");
    }

    // Additional constraints
    await validateTeacherConstraints(client, teacher_id, day_id);
    await validateRoomConstraints(client, room_id, program, section);

    // Create the allocation first to trigger any constraint checks
    const newAllocation = await client.query(
      `INSERT INTO allocations 
      (teacher_id, course_id, room_id, day_id, slot_id, program, section) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [teacher_id, course_id, room_id, day_id, slot_id, program, section]
    );

    // If allocation succeeds, update the availability
    await client.query(
      "UPDATE courses SET allocation_availability = allocation_availability - 1 WHERE course_id = $1",
      [course_id]
    );

    // Get full allocation details
    const allocation = await client.query(
      `SELECT 
          a.allocation_id,
          t.name as teacher_name,
          c.course_name,
          r.room_number,
          d.day_name,
          ts.start_time,
          ts.end_time,
          a.program,
          a.section
      FROM allocations a
      JOIN teachers t ON a.teacher_id = t.teacher_id
      JOIN courses c ON a.course_id = c.course_id
      JOIN rooms r ON a.room_id = r.room_id
      JOIN days d ON a.day_id = d.day_id
      JOIN time_slots ts ON a.slot_id = ts.slot_id
      WHERE a.allocation_id = $1`,
      [newAllocation.rows[0].allocation_id]
    );

    await client.query("COMMIT");
    res.json(allocation.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err.message);
    if (err.message.includes("consecutive time slots")) {
      res.status(400).json({
        error: err.message,
      });
    } else if (err.message.includes("room capacity")) {
      res.status(400).json({
        error: err.message,
      });
    } else if (err.message.includes("Cannot allocate course")) {
      res.status(400).json({
        error: "No slots available for this course",
      });
    } else if (err.code === "23505") {
      res.status(400).json({
        error: "This time slot is already allocated for the selected teacher",
      });
    } else {
      res.status(500).json({
        error: "Error creating allocation",
        details: err.message,
      });
    }
  } finally {
    client.release();
  }
});

// Get all allocations
app.get("/api/allocations", async (req, res) => {
  try {
    const allAllocations = await pool.query(`
            SELECT 
                a.allocation_id,
                t.name as teacher_name,
                c.course_name,
                r.room_number,
                d.day_name,
                ts.start_time,
                ts.end_time
            FROM allocations a
            JOIN teachers t ON a.teacher_id = t.teacher_id
            JOIN courses c ON a.course_id = c.course_id
            JOIN rooms r ON a.room_id = r.room_id
            JOIN days d ON a.day_id = d.day_id
            JOIN time_slots ts ON a.slot_id = ts.slot_id
            ORDER BY d.day_order, ts.slot_order
        `);
    res.json(allAllocations.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete allocation
app.delete("/api/allocations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: "Invalid allocation ID",
      });
    }

    // Fetch the course_id before deletion
    const allocation = await pool.query(
      "SELECT course_id FROM allocations WHERE allocation_id = $1",
      [id]
    );

    if (allocation.rows.length === 0) {
      return res.status(404).json({
        error: "Allocation not found",
      });
    }

    const course_id = allocation.rows[0].course_id;

    // Delete the allocation
    const result = await pool.query(
      "DELETE FROM allocations WHERE allocation_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Failed to delete allocation",
      });
    }

    // Update the allocation_availability value in the courses table
    const updateAvailability = await pool.query(
      `
            UPDATE courses
            SET allocation_availability = allocation_availability + 1
            WHERE course_id = $1
            RETURNING allocation_availability
            `,
      [course_id]
    );

    if (updateAvailability.rows.length === 0) {
      return res.status(500).json({
        error: "Failed to update allocation availability",
      });
    }

    res.json({
      message: "Allocation deleted successfully",
      course_id,
      new_availability: updateAvailability.rows[0].allocation_availability,
    });
  } catch (err) {
    console.error("Error in DELETE /api/allocations/:id:", err.message);
    res.status(500).json({
      error: "Error deleting allocation",
      details: err.message,
    });
  }
});

// Get routine
app.get("/api/routine", async (req, res) => {
  try {
    // Parameters from routineview.js
    const { program, section } = req.query;

    if (!program || !section) {
      return res
        .status(400)
        .json({ error: "Program and Section are required" });
    }

    const routine = await pool.query(
      "SELECT * FROM get_formatted_routine($1, $2)",
      [program, section]
    );

    // Transform the data into a structured format
    const formattedRoutine = routine.rows.reduce((acc, row) => {
      const { day_name, time_slot, course_code, room_number, teacher_name } =
        row;

      // Initialize day if not exists
      if (!acc[day_name]) {
        acc[day_name] = {};
      }

      // Add time slot data
      acc[day_name][time_slot] = {
        course_code,
        room_number,
        teacher_name,
      };

      return acc;
    }, {});

    res.json(formattedRoutine);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error fetching routine" });
  }
});

// Force regenerate routine
app.post("/api/routine/regenerate", async (req, res) => {
  try {
    await pool.query("SELECT generate_routine()");
    res.json({ message: "Routine regenerated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error regenerating routine" });
  }
});

// Get available sections for a course
app.get("/api/courses/:course_id/available-sections", async (req, res) => {
  try {
    const { course_id } = req.params;
    console.log("Fetching sections for course:", course_id);

    const availableSections = await pool.query(
      "SELECT * FROM get_available_sections($1)",
      [course_id]
    );

    console.log("Available sections data:", availableSections.rows);
    res.json(availableSections.rows);
  } catch (err) {
    console.error("Error in available sections:", err.message);
    res.status(500).json({
      error: "Error fetching available sections",
      details: err.message,
    });
  }
});

// Add this new endpoint
app.get("/api/available-days", async (req, res) => {
  try {
    const { course_id, section } = req.query;

    // Get all allocated days for this course and section
    const allocatedDays = await pool.query(
      `SELECT DISTINCT day_id 
       FROM allocations 
       WHERE course_id = $1 AND section = $2`,
      [course_id, section]
    );

    // Get all days
    const allDays = await pool.query(
      "SELECT day_id FROM days ORDER BY day_order"
    );

    // Filter out allocated days
    const allocatedDayIds = allocatedDays.rows.map((row) => row.day_id);
    const availableDayIds = allDays.rows
      .map((row) => row.day_id)
      .filter((dayId) => !allocatedDayIds.includes(dayId));

    res.json(availableDayIds);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Add this new endpoint before the last app.listen line
app.get("/api/available-time-slots", async (req, res) => {
  try {
    const { section, day_id, program } = req.query;

    if (!section || !day_id || !program) {
      return res
        .status(400)
        .json({ error: "Section, day_id and program are required" });
    }

    // Get all time slots
    const allTimeSlots = await pool.query(
      "SELECT * FROM time_slots ORDER BY slot_order"
    );

    // Get allocated time slots for this section and day
    const allocatedSlots = await pool.query(
      `SELECT DISTINCT slot_id 
       FROM allocations 
       WHERE section = $1 AND day_id = $2 AND program = $3`,
      [section, day_id, program]
    );

    // Filter out allocated slots
    const allocatedSlotIds = allocatedSlots.rows.map((row) => row.slot_id);
    const availableSlots = allTimeSlots.rows.filter(
      (slot) => !allocatedSlotIds.includes(slot.slot_id)
    );

    res.json(availableSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// // /// // // /// // // /// // // /// // // /// // // /// // // /// 

// Add this new endpoint before the last app.listen line
app.get("/api/teachers-with-allocations", async (req, res) => {
  try {
    const teachersWithAllocations = await pool.query(`
      SELECT DISTINCT t.teacher_id, t.name, t.email
      FROM teachers t
      INNER JOIN allocations a ON t.teacher_id = a.teacher_id
      ORDER BY t.name
    `);
    res.json(teachersWithAllocations.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Modify the existing teacher routine endpoint to include course names
app.get("/api/teachers/:teacherId/routine", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const routine = await pool.query(
      `
      SELECT 
        d.day_name,
        ts.start_time,
        ts.end_time,
        r.room_number,
        c.course_name
      FROM allocations a
      JOIN days d ON a.day_id = d.day_id
      JOIN time_slots ts ON a.slot_id = ts.slot_id
      JOIN rooms r ON a.room_id = r.room_id
      JOIN courses c ON a.course_id = c.course_id
      WHERE a.teacher_id = $1
      ORDER BY d.day_order, ts.slot_order
    `,
      [teacherId]
    );
    res.json(routine.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});
// // /// // // /// // // /// // // /// // // /// // // /// // // /// 


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
