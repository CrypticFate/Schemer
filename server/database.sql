-- Drop tables if they exist
DROP TABLE IF EXISTS allocations;
DROP TABLE IF EXISTS room_availability;
DROP TABLE IF EXISTS time_slots;
DROP TABLE IF EXISTS days;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS teachers;

-- Create Tables

-- Teachers Table
CREATE TABLE teachers (
    teacher_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

-- Courses Table
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    credit_hours DECIMAL(3,1) NOT NULL CHECK (credit_hours > 0)
);

-- Rooms Table
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    is_lab BOOLEAN DEFAULT false
);

-- Days Table
CREATE TABLE days (
    day_id SERIAL PRIMARY KEY,
    day_name VARCHAR(10) NOT NULL,
    day_order INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 5),
    UNIQUE(day_name),
    UNIQUE(day_order)
);

-- Time Slots Table
CREATE TABLE time_slots (
    slot_id SERIAL PRIMARY KEY,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_order INTEGER NOT NULL CHECK (slot_order BETWEEN 1 AND 4),
    UNIQUE(start_time, end_time),
    UNIQUE(slot_order),
    CHECK(end_time > start_time)
);

-- Allocations Table
CREATE TABLE allocations (
    allocation_id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE CASCADE,
    day_id INTEGER REFERENCES days(day_id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES time_slots(slot_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, day_id, slot_id),
    UNIQUE(teacher_id, day_id, slot_id)
);

-- Insert initial data

-- Insert days
INSERT INTO days (day_name, day_order) VALUES
    ('Monday', 1),
    ('Tuesday', 2),
    ('Wednesday', 3),
    ('Thursday', 4),
    ('Friday', 5);

-- Insert time slots
INSERT INTO time_slots (start_time, end_time, slot_order) VALUES
    ('08:30:00', '10:00:00', 1),
    ('10:30:00', '12:00:00', 2),
    ('13:30:00', '15:00:00', 3),
    ('15:30:00', '17:00:00', 4);

-- Insert rooms with capacity and lab status
INSERT INTO rooms (room_number, capacity, is_lab) VALUES
    ('301', 40, false),
    ('302', 40, false),
    ('303', 35, false),
    ('304', 30, true),  -- Lab
    ('305', 30, true),  -- Lab
    ('306', 45, false),
    ('307', 35, false);

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_available_rooms(INTEGER, INTEGER);

-- Function to get available rooms for a given day and time slot
CREATE OR REPLACE FUNCTION get_available_rooms(p_day_id INTEGER, p_slot_id INTEGER)
RETURNS TABLE (
    room_id INTEGER,
    room_number VARCHAR(10),
    capacity INTEGER,
    is_lab BOOLEAN
) AS $$
DECLARE
    valid_day BOOLEAN;
    valid_slot BOOLEAN;
BEGIN
    -- Check if day_id is valid
    SELECT EXISTS (
        SELECT 1 FROM days WHERE day_id = p_day_id
    ) INTO valid_day;

    IF NOT valid_day THEN
        RAISE EXCEPTION 'Invalid day_id: %', p_day_id;
    END IF;

    -- Check if slot_id is valid
    SELECT EXISTS (
        SELECT 1 FROM time_slots WHERE slot_id = p_slot_id
    ) INTO valid_slot;

    IF NOT valid_slot THEN
        RAISE EXCEPTION 'Invalid slot_id: %', p_slot_id;
    END IF;

    -- Return available rooms
    RETURN QUERY
    SELECT r.room_id, r.room_number, r.capacity, r.is_lab
    FROM rooms r
    WHERE NOT EXISTS (
        SELECT 1
        FROM allocations a
        WHERE a.room_id = r.room_id
        AND a.day_id = p_day_id
        AND a.slot_id = p_slot_id
    )
    ORDER BY r.room_number;
END;
$$ LANGUAGE plpgsql;

-- Insert sample teachers
INSERT INTO teachers (name, email) VALUES
    ('Dr. John Smith', 'john.smith@university.edu'),
    ('Prof. Sarah Johnson', 'sarah.johnson@university.edu'),
    ('Dr. Michael Chen', 'michael.chen@university.edu'),
    ('Prof. Emily Brown', 'emily.brown@university.edu'),
    ('Dr. David Wilson', 'david.wilson@university.edu'),
    ('Prof. Maria Garcia', 'maria.garcia@university.edu'),
    ('Dr. James Taylor', 'james.taylor@university.edu'),
    ('Prof. Lisa Anderson', 'lisa.anderson@university.edu'),
    ('Dr. Robert Martinez', 'robert.martinez@university.edu'),
    ('Prof. Amanda White', 'amanda.white@university.edu');

-- Insert sample courses
INSERT INTO courses (course_code, course_name, credit_hours) VALUES
    -- Computer Science Courses
    ('CSE101', 'Introduction to Programming', 3.0),
    ('CSE201', 'Data Structures and Algorithms', 3.0),
    ('CSE301', 'Database Management Systems', 3.0),
    ('CSE302', 'Operating Systems', 3.0),
    ('CSE401', 'Artificial Intelligence', 3.0);
