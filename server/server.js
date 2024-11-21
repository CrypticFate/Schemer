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
        const allDays = await pool.query(
            "SELECT * FROM days ORDER BY day_order"
        );
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

// Room availability routes
app.get("/api/room-availability", async (req, res) => {
    try {
        const { day_id, slot_id } = req.query;
        
        // Validate input parameters
        if (!day_id || !slot_id) {
            return res.status(400).json({ 
                error: "Both day_id and slot_id are required parameters" 
            });
        }

        // Convert to integers
        const dayId = parseInt(day_id);
        const slotId = parseInt(slot_id);

        if (isNaN(dayId) || isNaN(slotId)) {
            return res.status(400).json({ 
                error: "day_id and slot_id must be valid numbers" 
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
        if (err.message.includes('Invalid day_id') || err.message.includes('Invalid slot_id')) {
            return res.status(400).json({ 
                error: err.message 
            });
        }

        res.status(500).json({ 
            error: "Error fetching available rooms",
            details: err.message 
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
        res.status(500).json({ error: err.message });
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

// Allocations routes
app.post("/api/allocations", async (req, res) => {
    try {
        const { teacher_id, course_id, room_id, day_id, slot_id } = req.body;

        // Validate required fields
        if (!teacher_id || !course_id || !room_id || !day_id || !slot_id) {
            return res.status(400).json({
                error: "All fields are required (teacher_id, course_id, room_id, day_id, slot_id)"
            });
        }

        // Check if room is available
        const availableRooms = await pool.query(
            "SELECT * FROM get_available_rooms($1, $2) WHERE room_id = $3",
            [day_id, slot_id, room_id]
        );

        if (availableRooms.rows.length === 0) {
            return res.status(400).json({
                error: "Selected room is not available for this time slot"
            });
        }

        // Create allocation
        const newAllocation = await pool.query(
            `INSERT INTO allocations 
            (teacher_id, course_id, room_id, day_id, slot_id) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`,
            [teacher_id, course_id, room_id, day_id, slot_id]
        );

        // Get full allocation details
        const allocation = await pool.query(
            `SELECT 
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
            WHERE a.allocation_id = $1`,
            [newAllocation.rows[0].allocation_id]
        );

        res.json(allocation.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') {
            res.status(400).json({
                error: "This time slot is already allocated for the selected room or teacher"
            });
        } else {
            res.status(500).json({
                error: "Error creating allocation",
                details: err.message
            });
        }
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
                error: "Invalid allocation ID"
            });
        }

        const result = await pool.query(
            "DELETE FROM allocations WHERE allocation_id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Allocation not found"
            });
        }

        res.json({ message: "Allocation deleted successfully" });
    } catch (err) {
        console.error("Error in DELETE /api/allocations/:id:", err.message);
        res.status(500).json({
            error: "Error deleting allocation",
            details: err.message
        });
    }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
