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
        res.status(500).json({ error: "Server error fetching days" });
    }
});

// Time slots routes
app.get("/api/time-slots", async (req, res) => {
    try {
        const { type } = req.query; // Get optional 'type' query parameter

        let query = "SELECT * FROM time_slots";
        const queryParams = [];

        if (type && (type === 'Theory' || type === 'Lab')) {
            query += " WHERE slot_type = $1";
            queryParams.push(type);
        } else if (type) {
             return res.status(400).json({ error: "Invalid time slot type specified. Use 'Theory' or 'Lab'." });
        }

        query += " ORDER BY slot_order";

        const allTimeSlots = await pool.query(query, queryParams);
        res.json(allTimeSlots.rows);
    } catch (err) {
        console.error(err.message);
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
        if (allocation.rows.length === 0) {
            return res.json({ teacher_name: null });
        }
        const teacher_id = allocation.rows[0].teacher_id;
        const teacher = await pool.query(
            `SELECT name FROM teachers WHERE teacher_id = $1`,
            [teacher_id]
        );
        if (teacher.rows.length === 0) {
             return res.status(404).json({ error: "Teacher not found for existing allocation" });
        }
        res.json({ teacher_name: teacher.rows[0].name });
    } catch (err) {
        console.error(err.message);
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
        if (course.rows.length === 0) {
            return res.json({ allocation_availability: null });
        }
        res.json({ allocation_availability: course.rows[0].allocation_availability });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching course availability" });
    }
});

// Room availability routes
app.get("/api/room-availability", async (req, res) => {
    try {
        const { day_id, slot_id, course_type } = req.query; // Added course_type

        if (!day_id || !slot_id || !course_type) {
            return res.status(400).json({
                error: "day_id, slot_id, and course_type are required parameters",
            });
        }
        if (course_type !== 'Theory' && course_type !== 'Lab') {
             return res.status(400).json({ error: "Invalid course_type. Must be 'Theory' or 'Lab'." });
        }

        const dayId = parseInt(day_id);
        const slotId = parseInt(slot_id);

        if (isNaN(dayId) || isNaN(slotId)) {
            return res.status(400).json({
                error: "day_id and slot_id must be valid numbers",
            });
        }

        // Call the MODIFIED database function
        const availableRooms = await pool.query(
            "SELECT * FROM get_available_rooms($1, $2, $3)",
            [dayId, slotId, course_type] // Pass course_type
        );

        res.json(availableRooms.rows || []);
    } catch (err) {
        console.error("Error in /api/room-availability:", err.message);
        if (err.message.includes("Invalid day_id") || err.message.includes("Invalid slot_id")) {
             return res.status(400).json({ error: err.message });
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
        const allTeachers = await pool.query("SELECT * FROM teachers ORDER BY name");
        res.json(allTeachers.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching teachers" });
    }
});

// Create teacher
app.post("/api/teachers", async (req, res) => {
   try {
        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: "Both name and email are required" });
        }
        const newTeacher = await pool.query(
            "INSERT INTO teachers (name, email) VALUES ($1, $2) RETURNING *",
            [name, email]
        );
        res.json(newTeacher.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === "23505") { // Unique constraint violation for email
            res.status(400).json({ error: "A teacher with this email already exists" });
        } else {
            res.status(500).json({ error: "Error creating teacher", details: err.message });
        }
    }
});

// Get teacher's schedule (Assuming get_teacher_schedule SQL function exists and is correct)
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
         res.status(500).json({ error: "Server error fetching teacher schedule", details: err.message });
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
        console.error(err.message);
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

        if (course.rows.length === 0) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.json(course.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching course by ID" });
    }
});

// Create course
app.post("/api/courses", async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const {
            course_code, course_name, credit_hours,
            program_value, program_name, course_type
        } = req.body;

        // Basic Validations
        if (!course_code || !course_name || !credit_hours || !program_name || !program_value || !course_type) {
            throw new Error("Course code, name, credit hours, program value, program name, and course type are required");
        }
        if (course_type !== 'Theory' && course_type !== 'Lab') {
             throw new Error("Invalid course_type. Must be 'Theory' or 'Lab'.");
        }
        if (credit_hours <= 0 || credit_hours > 3) {
            throw new Error("Credit hours must be between 0.1 and 3.0");
        }

         const slots_needed_per_section = Math.ceil(parseFloat(credit_hours) / 1.5);
         const allocationAvailability = slots_needed_per_section * parseInt(program_value, 10);

        const newCourse = await client.query(
            `INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability, course_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [ course_code, course_name, credit_hours, program_name, allocationAvailability, course_type ]
        );

        await client.query("COMMIT");
        res.json(newCourse.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating course:", err.message);
        if (err.code === "23505") {
            res.status(400).json({ error: "A course with this code already exists." });
        } else if (err.message.includes("required") || err.message.includes("Invalid")) {
             res.status(400).json({ error: err.message });
        } else {
            res.status(500).json({ error: "Server error creating course", details: err.message });
        }
    } finally {
        client.release();
    }
});


// Rooms routes
app.get("/api/rooms", async (req, res) => {
    try {
        const allRooms = await pool.query("SELECT * FROM rooms ORDER BY room_number");
        res.json(allRooms.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching rooms" });
    }
});

// VALIDATION FUNCTIONS (Server-side JS, less critical if DB triggers are robust)
const validateTeacherConstraints = async (client, teacher_id, day_id) => { /* ... */ };
const validateRoomConstraints = async (client, room_id, program, section) => { /* ... */ };


// Allocations routes (creating new allocations)
app.post("/api/allocations", async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const {
            teacher_id, course_id, room_id, day_id, slot_id, program, section,
        } = req.body;

        // --- Validation ---
        if (!teacher_id || !course_id || !room_id || !day_id || !slot_id || !program || !section) {
            throw new Error("All fields are required");
        }

        // 1. Get Course Type and Room Type for validation
        const courseResult = await client.query("SELECT course_type FROM courses WHERE course_id = $1", [course_id]);
        const roomResult = await client.query("SELECT is_lab FROM rooms WHERE room_id = $1", [room_id]);
        const slotResult = await client.query("SELECT slot_type FROM time_slots WHERE slot_id = $1", [slot_id]);

        if (courseResult.rows.length === 0) throw new Error("Invalid Course ID");
        if (roomResult.rows.length === 0) throw new Error("Invalid Room ID");
        if (slotResult.rows.length === 0) throw new Error("Invalid Slot ID");

        const courseType = courseResult.rows[0].course_type;
        const isLabRoom = roomResult.rows[0].is_lab;
        const slotType = slotResult.rows[0].slot_type;

        // 2. Validate Course Type vs Slot Type
        if (courseType !== slotType) {
            throw new Error(`Course type (${courseType}) does not match the selected time slot type (${slotType}).`);
        }

        // 3. Validate Room Type vs Course Type
        if (courseType === 'Lab' && !isLabRoom) throw new Error("Lab courses must be allocated to Lab rooms.");
        if (courseType === 'Theory' && isLabRoom) throw new Error("Theory courses cannot be allocated to Lab rooms.");

        // 4. Check Room Availability (using DB function)
        const availableRooms = await client.query(
            "SELECT * FROM get_available_rooms($1, $2, $3) WHERE room_id = $4",
            [day_id, slot_id, courseType, room_id]
        );
        if (availableRooms.rows.length === 0) {
             const roomCheck = await client.query("SELECT room_number FROM rooms WHERE room_id = $1", [room_id]);
             const requiredType = courseType === 'Lab' ? 'Lab' : 'non-Lab';
             throw new Error(`Selected room ${roomCheck.rows[0]?.room_number || room_id} is not available for a ${requiredType} course at this time slot.`);
        }

        // --- Create Allocation (DB Triggers handle constraints like workload, section limit, etc.) ---
        const newAllocation = await client.query(
            `INSERT INTO allocations (teacher_id, course_id, room_id, day_id, slot_id, program, section)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING allocation_id`,
            [teacher_id, course_id, room_id, day_id, slot_id, program, section]
        );

        // --- Update Availability Counter ---
        await client.query(
            "UPDATE courses SET allocation_availability = allocation_availability - 1 WHERE course_id = $1",
            [course_id]
        );

        // --- Get Details for Response ---
        const allocationDetails = await client.query(
            `SELECT a.allocation_id, t.name as teacher_name, c.course_name, c.course_type, r.room_number, r.is_lab,
                    d.day_name, ts.start_time, ts.end_time, ts.slot_type, a.program, a.section
             FROM allocations a
             JOIN teachers t ON a.teacher_id = t.teacher_id JOIN courses c ON a.course_id = c.course_id
             JOIN rooms r ON a.room_id = r.room_id JOIN days d ON a.day_id = d.day_id
             JOIN time_slots ts ON a.slot_id = ts.slot_id
             WHERE a.allocation_id = $1`,
            [newAllocation.rows[0].allocation_id]
        );

        await client.query("COMMIT");
        res.status(201).json(allocationDetails.rows[0]);

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Allocation Error:", err); // Log the actual error object

        // Handle specific DB constraint errors or custom errors
        if (err.code === '23505' && err.constraint?.includes('allocations_room_id_day_id_slot_id_key')) {
            res.status(409).json({ error: "This Room is already booked for the selected Day and Time Slot." });
        } else if (err.code === '23505' && err.constraint?.includes('allocations_teacher_id_day_id_slot_id_key')) {
            res.status(409).json({ error: "This Teacher is already allocated for the selected Day and Time Slot." });
        } else if (err.message.includes("workload would exceed") || err.message.includes("maximum allocation limit") || err.message.includes("No slots available")) {
             res.status(400).json({ error: err.message }); // Errors from DB triggers
        } else if (err.message.includes("Course type") || err.message.includes("Lab courses must") || err.message.includes("Theory courses cannot") || err.message.includes("not available for") || err.message.includes("All fields are required") || err.message.includes("Invalid")) {
             res.status(400).json({ error: err.message }); // Custom validation errors
        } else {
            res.status(500).json({ error: "Error creating allocation", details: err.message });
        }
    } finally {
        client.release();
    }
});


// Get all allocations
app.get("/api/allocations", async (req, res) => {
    try {
        const allAllocations = await pool.query(`
            SELECT a.allocation_id, t.name as teacher_name, c.course_name, c.course_type, r.room_number, r.is_lab,
                   d.day_name, ts.start_time, ts.end_time, ts.slot_type
            FROM allocations a
            JOIN teachers t ON a.teacher_id = t.teacher_id JOIN courses c ON a.course_id = c.course_id
            JOIN rooms r ON a.room_id = r.room_id JOIN days d ON a.day_id = d.day_id
            JOIN time_slots ts ON a.slot_id = ts.slot_id
            ORDER BY d.day_order, ts.slot_order
        `);
        res.json(allAllocations.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching all allocations" });
    }
});

// Delete allocation
app.delete("/api/allocations/:id", async (req, res) => {
    const client = await pool.connect(); // Use client for transaction
    try {
        await client.query('BEGIN');
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ error: "Invalid allocation ID" });
        }

        // Fetch the course_id before deletion
        const allocation = await client.query(
            "SELECT course_id FROM allocations WHERE allocation_id = $1", [id]
        );
        if (allocation.rows.length === 0) {
            return res.status(404).json({ error: "Allocation not found" });
        }
        const course_id = allocation.rows[0].course_id;

        // Delete the allocation
        const result = await client.query(
            "DELETE FROM allocations WHERE allocation_id = $1 RETURNING *", [id]
        );
        if (result.rows.length === 0) {
             // Should not happen if select worked, but good practice
             throw new Error("Failed to delete allocation after finding it.");
        }

        // Update the allocation_availability value
        const updateAvailability = await client.query(
            `UPDATE courses SET allocation_availability = allocation_availability + 1
             WHERE course_id = $1 RETURNING allocation_availability`, [course_id]
        );
        if (updateAvailability.rows.length === 0) {
            throw new Error("Failed to update allocation availability for the course.");
        }

        await client.query('COMMIT');
        res.json({
            message: "Allocation deleted successfully",
            course_id,
            new_availability: updateAvailability.rows[0].allocation_availability,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error in DELETE /api/allocations/:id:", err.message);
        res.status(500).json({ error: "Error deleting allocation", details: err.message });
    } finally {
        client.release();
    }
});

// Get routine
app.get("/api/routine", async (req, res) => {
    try {
        const { program, section } = req.query;
        if (!program || !section) {
            return res.status(400).json({ error: "Program and Section are required" });
        }
        const routine = await pool.query(
            "SELECT * FROM get_formatted_routine($1, $2)", [program, section]
        );
        // Transform the data (assuming get_formatted_routine returns flat rows)
        const formattedRoutine = routine.rows.reduce((acc, row) => {
            const { day_name, time_slot, course_code, room_number, teacher_name } = row;
            if (!acc[day_name]) acc[day_name] = {};
            acc[day_name][time_slot] = { course_code, room_number, teacher_name };
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
        await pool.query("SELECT generate_routine()"); // Assuming function exists
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
        const availableSections = await pool.query(
            "SELECT * FROM get_available_sections($1)", [course_id]
        );
        res.json(availableSections.rows);
    } catch (err) {
        console.error("Error in available sections:", err.message);
        res.status(500).json({ error: "Error fetching available sections", details: err.message });
    }
});


// Get available days for a course/section - WITH ENHANCED LOGGING
app.get("/api/available-days", async (req, res) => {
    console.log(`[${new Date().toISOString()}] SERVER: /api/available-days requested`);
    console.log(`[${new Date().toISOString()}] SERVER: Query Params:`, req.query);
    try {
        const { course_id, section } = req.query;
        if (!course_id || !section) {
             console.error(`[${new Date().toISOString()}] SERVER ERROR: Missing course_id or section`);
             return res.status(400).json({ error: "Course ID and Section are required." });
        }
        console.log(`[${new Date().toISOString()}] SERVER: Querying allocated days for course ${course_id}, section ${section}`);
        const allocatedDays = await pool.query(
          `SELECT DISTINCT day_id FROM allocations WHERE course_id = $1 AND section = $2::INTEGER`,
          [course_id, section]
        );
        console.log(`[${new Date().toISOString()}] SERVER: Found ${allocatedDays.rowCount} allocated days.`);

        console.log(`[${new Date().toISOString()}] SERVER: Querying all days.`);
        const allDays = await pool.query("SELECT day_id FROM days ORDER BY day_order");
        console.log(`[${new Date().toISOString()}] SERVER: Found ${allDays.rowCount} total days.`);

        const allocatedDayIds = allocatedDays.rows.map((row) => row.day_id);
        const availableDayIds = allDays.rows.map((row) => row.day_id).filter((dayId) => !allocatedDayIds.includes(dayId));

        console.log(`[${new Date().toISOString()}] SERVER: Sending available day IDs:`, availableDayIds);
        res.json(availableDayIds);
        console.log(`[${new Date().toISOString()}] SERVER: Response sent for /api/available-days.`);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] SERVER ERROR in /api/available-days:`, err.message);
        console.error(err.stack);
        res.status(500).json({ error: "Server error fetching available days" });
    }
});

// Get available time slots
app.get("/api/available-time-slots", async (req, res) => {
    try {
        const { section, day_id, program, course_id } = req.query;
        if (!section || !day_id || !program || !course_id) {
            return res.status(400).json({ error: "Section, day_id, program, and course_id are required" });
        }

        const courseResult = await pool.query("SELECT course_type FROM courses WHERE course_id = $1", [course_id]);
        if (courseResult.rows.length === 0) {
             return res.status(404).json({ error: "Course not found" });
        }
        const courseType = courseResult.rows[0].course_type;

        const allSlotsOfType = await pool.query(
            "SELECT * FROM time_slots WHERE slot_type = $1 ORDER BY slot_order", [courseType]
        );

        const allocatedSlots = await pool.query(
            `SELECT DISTINCT slot_id FROM allocations WHERE section = $1::INTEGER AND day_id = $2 AND program = $3`,
            [section, day_id, program] // Assuming day_id and program are correct types
        );
        const allocatedSlotIds = allocatedSlots.rows.map((row) => row.slot_id);

        const availableSlots = allSlotsOfType.rows.filter(
            (slot) => !allocatedSlotIds.includes(slot.slot_id)
        );

        res.json(availableSlots);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching available time slots" });
    }
});


// Get teachers with allocations
app.get("/api/teachers-with-allocations", async (req, res) => {
   try {
        const teachersWithAllocations = await pool.query(`
            SELECT DISTINCT t.teacher_id, t.name, t.email FROM teachers t
            INNER JOIN allocations a ON t.teacher_id = a.teacher_id
            ORDER BY t.name
        `);
        res.json(teachersWithAllocations.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching teachers with allocations" });
    }
});

// Get specific teacher's routine (Modify query if get_teacher_schedule function is not used/correct)
app.get("/api/teachers/:teacherId/routine", async (req, res) => {
   try {
        const { teacherId } = req.params;
        // This query directly fetches needed info, may be more reliable than a stored function
        const routine = await pool.query(
            `SELECT d.day_name, ts.start_time, ts.end_time, r.room_number, c.course_name, c.course_type, c.credit_hours
             FROM allocations a
             JOIN days d ON a.day_id = d.day_id
             JOIN time_slots ts ON a.slot_id = ts.slot_id
             JOIN rooms r ON a.room_id = r.room_id
             JOIN courses c ON a.course_id = c.course_id
             WHERE a.teacher_id = $1
             ORDER BY d.day_order, ts.slot_order`, [teacherId]
        );
        res.json(routine.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching teacher routine", details: err.message });
    }
});


const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Server is running on port ${port}`);
});