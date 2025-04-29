const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");

// middleware
app.use(cors());
app.use(express.json());

// --- Add detailed logging helper ---
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  // Avoid logging excessively large objects if not needed, stringify selectively
  const dataString =
    data !== null
      ? typeof data === "object"
        ? JSON.stringify(data)
        : data
      : "";
  console.log(`[${timestamp}] [${level}] ${message}`, dataString);
};
// ---------------------------------

// Import routes
const teacherRoutes = require("./routes/teachers");
const courseRoutes = require("./routes/courses");

// Use routes
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);

// Days routes
app.get("/api/days", async (req, res) => {
  try {
    const allDays = await pool.query("SELECT * FROM days ORDER BY day_order");
    res.json(allDays.rows);
  } catch (err) {
    log("ERROR", "Error fetching days:", { message: err.message });
    res.status(500).json({ error: "Server error fetching days" });
  }
});

// Time slots routes
app.get("/api/time-slots", async (req, res) => {
  try {
    const { type } = req.query;
    let query = "SELECT * FROM time_slots";
    const queryParams = [];
    if (type && (type === "Theory" || type === "Lab")) {
      query += " WHERE slot_type = $1";
      queryParams.push(type);
    } else if (type) {
      return res.status(400).json({
        error: "Invalid time slot type specified. Use 'Theory' or 'Lab'.",
      });
    }
    query += " ORDER BY slot_order";
    const allTimeSlots = await pool.query(query, queryParams);
    res.json(allTimeSlots.rows);
  } catch (err) {
    log("ERROR", "Error fetching time slots:", { message: err.message });
    res.status(500).json({ error: "Server error fetching time slots" });
  }
});

// Route to fetch teacher name by course_id
app.get("/api/get-teacher-by-course/:course_id", async (req, res) => {
  const { course_id } = req.params;
  try {
    const allocation = await pool.query(
      `SELECT teacher_id FROM allocations WHERE course_id = $1 LIMIT 1`,
      [course_id]
    );
    if (allocation.rows.length === 0) return res.json({ teacher_name: null });
    const teacher_id = allocation.rows[0].teacher_id;
    const teacher = await pool.query(
      `SELECT name FROM teachers WHERE teacher_id = $1`,
      [teacher_id]
    );
    if (teacher.rows.length === 0)
      return res
        .status(404)
        .json({ error: "Teacher not found for existing allocation" });
    res.json({ teacher_name: teacher.rows[0].name });
  } catch (err) {
    log("ERROR", `Error fetching teacher by course ${course_id}:`, {
      message: err.message,
    });
    res.status(500).json({ error: "Server error fetching teacher by course" });
  }
});

// Allocation Availability route from Course table
app.get("/api/get-availability-by-course/:course_id", async (req, res) => {
  const { course_id } = req.params;
  try {
    const course = await pool.query(
      `SELECT allocation_availability FROM courses WHERE course_id = $1 LIMIT 1`,
      [course_id]
    );
    if (course.rows.length === 0)
      return res.json({ allocation_availability: null });
    res.json({
      allocation_availability: course.rows[0].allocation_availability,
    });
  } catch (err) {
    log("ERROR", `Error fetching course availability ${course_id}:`, {
      message: err.message,
    });
    res
      .status(500)
      .json({ error: "Server error fetching course availability" });
  }
});

// Room availability routes
app.get("/api/room-availability", async (req, res) => {
  try {
    const { day_id, slot_id, course_type } = req.query;
    if (!day_id || !slot_id || !course_type)
      return res
        .status(400)
        .json({ error: "day_id, slot_id, and course_type are required" });
    if (course_type !== "Theory" && course_type !== "Lab")
      return res.status(400).json({ error: "Invalid course_type" });
    const dayId = parseInt(day_id);
    const slotId = parseInt(slot_id);
    if (isNaN(dayId) || isNaN(slotId))
      return res
        .status(400)
        .json({ error: "day_id and slot_id must be numbers" });

    const availableRooms = await pool.query(
      "SELECT * FROM get_available_rooms($1, $2, $3)",
      [dayId, slotId, course_type]
    );
    res.json(availableRooms.rows || []);
  } catch (err) {
    log("ERROR", "Error fetching room availability:", {
      message: err.message,
      query: req.query,
    });
    if (
      err.message.includes("Invalid day_id") ||
      err.message.includes("Invalid slot_id")
    )
      return res.status(400).json({ error: err.message });
    res
      .status(500)
      .json({ error: "Error fetching available rooms", details: err.message });
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
    log("ERROR", "Error fetching teachers:", { message: err.message });
    res.status(500).json({ error: "Server error fetching teachers" });
  }
});

// Get teacher's schedule
app.get("/api/teachers/:teacherId/schedule", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schedule = await pool.query(
      "SELECT * FROM get_teacher_schedule($1)",
      [teacherId]
    ); // Ensure function exists/is correct
    res.json(schedule.rows);
  } catch (err) {
    log("ERROR", `Error fetching teacher schedule ${teacherId}:`, {
      message: err.message,
    });
    res.status(500).json({
      error: "Server error fetching teacher schedule",
      details: err.message,
    });
  }
});

// Courses routes
app.get("/api/courses", async (req, res) => {
  try {
    const allCourses = await pool.query(
      "SELECT course_id, course_code, course_name, credit_hours, program, allocation_availability, course_type FROM courses ORDER BY course_code"
    );
    res.json(allCourses.rows);
  } catch (err) {
    log("ERROR", "Error fetching courses:", { message: err.message });
    res.status(500).json({ error: "Server error fetching courses" });
  }
});

// Get course by ID
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const course = await pool.query(
      "SELECT course_id, course_code, course_name, credit_hours, program, allocation_availability, course_type FROM courses WHERE course_id = $1",
      [id]
    );
    if (course.rows.length === 0)
      return res.status(404).json({ error: "Course not found" });
    res.json(course.rows[0]);
  } catch (err) {
    log("ERROR", `Error fetching course by ID ${id}:`, {
      message: err.message,
    });
    res.status(500).json({ error: "Server error fetching course by ID" });
  }
});

// Create course
app.post("/api/courses", async (req, res) => {
  log("INFO", "/api/courses POST request received");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      course_code,
      course_name,
      credit_hours,
      program_value,
      program_name,
      course_type,
    } = req.body;
    log("INFO", "Received course data:", req.body);

    if (
      !course_code ||
      !course_name ||
      !credit_hours ||
      !program_name ||
      !program_value ||
      !course_type
    )
      throw new Error("VALIDATION_ERROR: All fields required");
    if (course_type !== "Theory" && course_type !== "Lab")
      throw new Error("VALIDATION_ERROR: Invalid course_type");
    if (credit_hours <= 0 || credit_hours > 3)
      throw new Error("VALIDATION_ERROR: Invalid credit hours");

    const slots_needed_per_section = Math.ceil(parseFloat(credit_hours) / 1.5);
    const allocationAvailability =
      slots_needed_per_section * parseInt(program_value, 10);
    log(
      "DEBUG",
      `Calculated availability: ${allocationAvailability} (slots=${slots_needed_per_section}, prog_val=${program_value})`
    );

    const newCourse = await client.query(
      `INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability, course_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        course_code.trim().toUpperCase(),
        course_name.trim(),
        credit_hours,
        program_name,
        allocationAvailability,
        course_type,
      ]
    );
    log("INFO", "Course inserted successfully", newCourse.rows[0]);

    await client.query("COMMIT");
    log("INFO", "Course creation transaction committed.");
    res.status(201).json(newCourse.rows[0]); // Use 201 status
  } catch (err) {
    await client.query("ROLLBACK");
    log("ERROR", "Error creating course:", {
      message: err.message,
      code: err.code,
      body: req.body,
    });
    if (err.code === "23505")
      res
        .status(400)
        .json({ error: "A course with this code already exists." });
    else if (err.message?.includes("VALIDATION_ERROR:"))
      res
        .status(400)
        .json({ error: err.message.replace("VALIDATION_ERROR: ", "") });
    else
      res
        .status(500)
        .json({ error: "Server error creating course", details: err.message });
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
    log("ERROR", "Error fetching rooms:", { message: err.message });
    res.status(500).json({ error: "Server error fetching rooms" });
  }
});

// Allocations routes (creating new allocations)
app.post("/api/allocations", async (req, res) => {
  log("INFO", "/api/allocations POST request received");
  const client = await pool.connect();
  log("DEBUG", "Database client connected");
  try {
    log("DEBUG", "Starting transaction");
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
    log("INFO", "Received allocation data:", req.body);

    // --- Validation ---
    log("DEBUG", "Performing validation checks...");
    if (
      !teacher_id ||
      !course_id ||
      !room_id ||
      !day_id ||
      !slot_id ||
      !program ||
      !section
    )
      throw new Error("VALIDATION_ERROR: All fields are required");

    log("DEBUG", "Fetching related entity details (Course, Room, Slot)");
    const courseResult = await client.query(
      "SELECT course_type FROM courses WHERE course_id = $1",
      [course_id]
    );
    const roomResult = await client.query(
      "SELECT is_lab FROM rooms WHERE room_id = $1",
      [room_id]
    );
    const slotResult = await client.query(
      "SELECT slot_type FROM time_slots WHERE slot_id = $1",
      [slot_id]
    );

    if (courseResult.rows.length === 0)
      throw new Error(`VALIDATION_ERROR: Invalid Course ID: ${course_id}`);
    if (roomResult.rows.length === 0)
      throw new Error(`VALIDATION_ERROR: Invalid Room ID: ${room_id}`);
    if (slotResult.rows.length === 0)
      throw new Error(`VALIDATION_ERROR: Invalid Slot ID: ${slot_id}`);

    const courseType = courseResult.rows[0].course_type;
    const isLabRoom = roomResult.rows[0].is_lab;
    const slotType = slotResult.rows[0].slot_type;
    log(
      "DEBUG",
      `Details fetched: courseType=${courseType}, isLabRoom=${isLabRoom}, slotType=${slotType}`
    );

    if (courseType !== slotType)
      throw new Error(
        `VALIDATION_ERROR: Course type (${courseType}) does not match slot type (${slotType}).`
      );
    if (courseType === "Lab" && !isLabRoom)
      throw new Error("VALIDATION_ERROR: Lab courses must use Lab rooms.");
    if (courseType === "Theory" && isLabRoom)
      throw new Error("VALIDATION_ERROR: Theory courses cannot use Lab rooms.");

    log(
      "DEBUG",
      `Checking room availability via get_available_rooms: day=${day_id}, slot=${slot_id}, type=${courseType}, room=${room_id}`
    );
    const availableRooms = await client.query(
      "SELECT room_id FROM get_available_rooms($1, $2, $3) WHERE room_id = $4",
      [day_id, slot_id, courseType, room_id]
    );
    if (availableRooms.rows.length === 0) {
      const roomCheck = await client.query(
        "SELECT room_number FROM rooms WHERE room_id = $1",
        [room_id]
      );
      throw new Error(
        `VALIDATION_ERROR: Room ${
          roomCheck.rows[0]?.room_number || room_id
        } unavailable for ${courseType} at this time.`
      );
    }
    log("DEBUG", "Room availability check passed.");

    // --- Database Operations ---
    log("DEBUG", "Attempting to INSERT into allocations table...");
    const newAllocation = await client.query(
      `INSERT INTO allocations (teacher_id, course_id, room_id, day_id, slot_id, program, section) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING allocation_id`,
      [teacher_id, course_id, room_id, day_id, slot_id, program, section]
    );
    const newAllocationId = newAllocation.rows[0].allocation_id;
    log("INFO", `Successfully INSERTED allocation, new ID: ${newAllocationId}`);

    log(
      "DEBUG",
      `Attempting to UPDATE courses table for course_id: ${course_id}`
    );
    const updateResult = await client.query(
      "UPDATE courses SET allocation_availability = allocation_availability - 1 WHERE course_id = $1 RETURNING allocation_availability",
      [course_id]
    );
    if (updateResult.rowCount === 0)
      throw new Error(
        `DB_ERROR: Failed to update availability count for course_id ${course_id}.`
      );
    log(
      "INFO",
      `Successfully UPDATED course availability, new count: ${updateResult.rows[0].allocation_availability}`
    );

    log("DEBUG", "Attempting to COMMIT transaction.");
    await client.query("COMMIT");
    log("INFO", "Transaction COMMITTED successfully.");

    // --- Fetch Details for Response AFTER COMMIT ---
    log("DEBUG", `Fetching full details for allocation ID: ${newAllocationId}`);
    const allocationDetails = await pool.query(
      // Use pool now
      `SELECT a.allocation_id, t.name as teacher_name, c.course_name, c.course_type, r.room_number, r.is_lab,
                    d.day_name, ts.start_time, ts.end_time, ts.slot_type, a.program, a.section
             FROM allocations a
             JOIN teachers t ON a.teacher_id = t.teacher_id JOIN courses c ON a.course_id = c.course_id
             JOIN rooms r ON a.room_id = r.room_id JOIN days d ON a.day_id = d.day_id
             JOIN time_slots ts ON a.slot_id = ts.slot_id WHERE a.allocation_id = $1`,
      [newAllocationId]
    );
    if (allocationDetails.rows.length === 0) {
      log(
        "WARN",
        `Could not fetch details for newly created allocation ID: ${newAllocationId}`
      );
      res.status(201).json({
        message: "Allocation created, but details couldn't be fetched.",
      });
    } else {
      log("INFO", "Sending success response (201) with allocation details.");
      res.status(201).json(allocationDetails.rows[0]);
    }
  } catch (err) {
    log("ERROR", "Error during allocation creation:", {
      message: err.message,
      code: err.code,
      constraint: err.constraint,
    });
    await client.query("ROLLBACK");
    log("INFO", "Transaction ROLLED BACK.");
    if (err.code === "23505") {
      log("ERROR", `Unique Constraint Violation: ${err.constraint}`);
      const message = err.constraint?.includes("teacher")
        ? "Teacher already booked at this time."
        : err.constraint?.includes("room")
        ? "Room already booked at this time."
        : "Allocation conflict detected.";
      res.status(409).json({ error: message });
    } else if (err.message?.includes("VALIDATION_ERROR:")) {
      log("ERROR", `Validation Failed: ${err.message}`);
      res
        .status(400)
        .json({ error: err.message.replace("VALIDATION_ERROR: ", "") });
    } else if (err.message?.includes("DB_ERROR:")) {
      log("ERROR", `Database Operation Failed: ${err.message}`);
      res.status(500).json({ error: err.message.replace("DB_ERROR: ", "") });
    } else if (
      err.message?.includes("constraint") ||
      err.message?.includes("workload") ||
      err.message?.includes("limit")
    ) {
      log("ERROR", `Database Constraint/Trigger Error: ${err.message}`);
      // Be cautious sending raw DB errors to client
      res.status(400).json({
        error:
          "Allocation constraint violation. Check teacher workload or section limits.",
      });
    } else {
      log("ERROR", "Unknown Server Error:", err);
      res
        .status(500)
        .json({ error: "Internal server error creating allocation." });
    }
  } finally {
    log("DEBUG", "Releasing database client.");
    client.release();
  }
});

// Get all allocations
app.get("/api/allocations", async (req, res) => {
  log("INFO", "/api/allocations GET request received");
  try {
    const allAllocations = await pool.query(`
            SELECT a.allocation_id, t.name as teacher_name, c.course_name, c.course_type, r.room_number, r.is_lab,
                   d.day_name, ts.start_time, ts.end_time, ts.slot_type, a.program, a.section
            FROM allocations a
            JOIN teachers t ON a.teacher_id = t.teacher_id JOIN courses c ON a.course_id = c.course_id
            JOIN rooms r ON a.room_id = r.room_id JOIN days d ON a.day_id = d.day_id
            JOIN time_slots ts ON a.slot_id = ts.slot_id
            ORDER BY d.day_order, ts.slot_order
        `);
    log("INFO", `Sending ${allAllocations.rowCount} allocations.`);
    res.json(allAllocations.rows);
  } catch (err) {
    log("ERROR", "Error fetching all allocations:", { message: err.message });
    res.status(500).json({ error: "Server error fetching all allocations" });
  }
});

// Delete allocation
app.delete("/api/allocations/:id", async (req, res) => {
  log(
    "INFO",
    `/api/allocations DELETE request received for ID: ${req.params.id}`
  );
  const client = await pool.connect();
  log("DEBUG", "Database client connected for DELETE");
  try {
    await client.query("BEGIN");
    log("DEBUG", "DELETE Transaction Started");
    const { id } = req.params;
    if (!id || isNaN(parseInt(id)))
      throw new Error("VALIDATION_ERROR: Invalid allocation ID");
    const allocationId = parseInt(id, 10);

    log("DEBUG", `Fetching course_id for allocation ID: ${allocationId}`);
    const allocation = await client.query(
      "SELECT course_id FROM allocations WHERE allocation_id = $1 FOR UPDATE",
      [allocationId]
    );
    if (allocation.rows.length === 0) {
      await client.query("ROLLBACK");
      log("WARN", `Allocation ID ${allocationId} not found for deletion.`);
      return res.status(404).json({ error: "Allocation not found" });
    }
    const course_id = allocation.rows[0].course_id;
    log("INFO", `Found course_id ${course_id} for allocation ${allocationId}`);

    log("DEBUG", `Attempting to DELETE allocation ID: ${allocationId}`);
    const result = await client.query(
      "DELETE FROM allocations WHERE allocation_id = $1 RETURNING allocation_id",
      [allocationId]
    );
    if (result.rowCount === 0)
      throw new Error(`DB_ERROR: Failed to delete allocation ${allocationId}.`);
    log("INFO", `Successfully DELETED allocation ID: ${allocationId}`);

    log(
      "DEBUG",
      `Attempting to UPDATE courses availability for course_id: ${course_id}`
    );
    const updateAvailability = await client.query(
      `UPDATE courses SET allocation_availability = allocation_availability + 1 WHERE course_id = $1 RETURNING allocation_availability`,
      [course_id]
    );
    if (updateAvailability.rowCount === 0)
      throw new Error(
        `DB_ERROR: Failed to update availability for course ${course_id}.`
      );
    log(
      "INFO",
      `Successfully UPDATED course availability, new count: ${updateAvailability.rows[0].allocation_availability}`
    );

    log("DEBUG", "Attempting to COMMIT DELETE transaction.");
    await client.query("COMMIT");
    log("INFO", "DELETE Transaction COMMITTED successfully.");
    res.json({ message: "Allocation deleted successfully" });
  } catch (err) {
    log("ERROR", "Error during allocation deletion:", {
      message: err.message,
      code: err.code,
    });
    await client.query("ROLLBACK");
    log("INFO", "DELETE Transaction ROLLED BACK.");
    if (err.message?.includes("VALIDATION_ERROR:"))
      res
        .status(400)
        .json({ error: err.message.replace("VALIDATION_ERROR: ", "") });
    else
      res
        .status(500)
        .json({ error: "Error deleting allocation", details: err.message });
  } finally {
    log("DEBUG", "Releasing database client after DELETE operation.");
    client.release();
  }
});

// Get routine
app.get("/api/routine", async (req, res) => {
  try {
    const { program, section } = req.query;
    if (!program || !section)
      return res
        .status(400)
        .json({ error: "Program and Section are required" });
    const routine = await pool.query(
      "SELECT * FROM get_formatted_routine($1, $2)",
      [program, section]
    );
    const formattedRoutine = routine.rows.reduce((acc, row) => {
      const { day_name, time_slot, course_code, room_number, teacher_name } =
        row;
      if (!acc[day_name]) acc[day_name] = {};
      acc[day_name][time_slot] = { course_code, room_number, teacher_name };
      return acc;
    }, {});
    res.json(formattedRoutine);
  } catch (err) {
    log("ERROR", "Error fetching routine:", { message: err.message });
    res.status(500).json({ error: "Error fetching routine" });
  }
});

// Force regenerate routine
app.post("/api/routine/regenerate", async (req, res) => {
  try {
    await pool.query("SELECT generate_routine()");
    log("INFO", "Routine regenerated successfully via API call.");
    res.json({ message: "Routine regenerated successfully" });
  } catch (err) {
    log("ERROR", "Error regenerating routine:", { message: err.message });
    res.status(500).json({ error: "Error regenerating routine" });
  }
});

// Get available sections for a course
app.get("/api/courses/:course_id/available-sections", async (req, res) => {
  try {
    const { course_id } = req.params;
    const availableSections = await pool.query(
      "SELECT * FROM get_available_sections($1)",
      [course_id]
    );
    res.json(availableSections.rows);
  } catch (err) {
    log("ERROR", `Error fetching available sections for course ${course_id}:`, {
      message: err.message,
    });
    res.status(500).json({
      error: "Error fetching available sections",
      details: err.message,
    });
  }
});

// Get available days for a course/section
app.get("/api/available-days", async (req, res) => {
  log("INFO", "/api/available-days GET request received", req.query);
  try {
    const { course_id, section } = req.query;
    if (!course_id || !section) {
      log("WARN", "Missing course_id or section in /api/available-days");
      return res
        .status(400)
        .json({ error: "Course ID and Section are required." });
    }
    const allocatedDays = await pool.query(
      `SELECT DISTINCT day_id FROM allocations WHERE course_id = $1 AND section = $2::INTEGER`,
      [course_id, section]
    );
    const allDays = await pool.query(
      "SELECT day_id FROM days ORDER BY day_order"
    );
    const allocatedDayIds = allocatedDays.rows.map((row) => row.day_id);
    const availableDayIds = allDays.rows
      .map((row) => row.day_id)
      .filter((dayId) => !allocatedDayIds.includes(dayId));
    log(
      "INFO",
      `Returning available day IDs for course ${course_id} section ${section}:`,
      availableDayIds
    );
    res.json(availableDayIds);
  } catch (err) {
    log("ERROR", "Error fetching available days:", {
      message: err.message,
      query: req.query,
    });
    res.status(500).json({ error: "Server error fetching available days" });
  }
});

// Get available time slots
app.get("/api/available-time-slots", async (req, res) => {
  log("INFO", "/api/available-time-slots GET request received", req.query);
  try {
    const { section, day_id, program, course_id } = req.query;
    if (!section || !day_id || !program || !course_id)
      return res.status(400).json({
        error: "Section, day_id, program, and course_id are required",
      });

    const courseResult = await pool.query(
      "SELECT course_type FROM courses WHERE course_id = $1",
      [course_id]
    );
    if (courseResult.rows.length === 0)
      return res.status(404).json({ error: "Course not found" });
    const courseType = courseResult.rows[0].course_type;

    const allSlotsOfType = await pool.query(
      "SELECT * FROM time_slots WHERE slot_type = $1 ORDER BY slot_order",
      [courseType]
    );
    const allocatedSlots = await pool.query(
      `SELECT DISTINCT slot_id FROM allocations WHERE section = $1::INTEGER AND day_id = $2 AND program = $3`,
      [section, day_id, program]
    );
    const allocatedSlotIds = allocatedSlots.rows.map((row) => row.slot_id);
    const availableSlots = allSlotsOfType.rows.filter(
      (slot) => !allocatedSlotIds.includes(slot.slot_id)
    );
    log(
      "INFO",
      `Returning ${availableSlots.length} available slots for type ${courseType}`
    );
    res.json(availableSlots);
  } catch (err) {
    log("ERROR", "Error fetching available time slots:", {
      message: err.message,
      query: req.query,
    });
    res
      .status(500)
      .json({ error: "Server error fetching available time slots" });
  }
});

// Get teachers with allocations
app.get("/api/teachers-with-allocations", async (req, res) => {
  try {
    const teachersWithAllocations = await pool.query(
      `SELECT DISTINCT t.teacher_id, t.name, t.email FROM teachers t JOIN allocations a ON t.teacher_id = a.teacher_id ORDER BY t.name`
    );
    res.json(teachersWithAllocations.rows);
  } catch (err) {
    log("ERROR", "Error fetching teachers with allocations:", {
      message: err.message,
    });
    res
      .status(500)
      .json({ error: "Server error fetching teachers with allocations" });
  }
});

// Get specific teacher's routine
app.get("/api/teachers/:teacherId/routine", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const routine = await pool.query(
      `SELECT d.day_name, ts.start_time, ts.end_time, r.room_number, c.course_name, c.course_type, c.credit_hours
             FROM allocations a JOIN days d ON a.day_id = d.day_id JOIN time_slots ts ON a.slot_id = ts.slot_id
             JOIN rooms r ON a.room_id = r.room_id JOIN courses c ON a.course_id = c.course_id
             WHERE a.teacher_id = $1 ORDER BY d.day_order, ts.slot_order`,
      [teacherId]
    );
    res.json(routine.rows);
  } catch (err) {
    log("ERROR", `Error fetching teacher routine for ${teacherId}:`, {
      message: err.message,
    });
    res.status(500).json({
      error: "Server error fetching teacher routine",
      details: err.message,
    });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  log("INFO", `Server is running on port ${port}`);
});
