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
    credit_hours DECIMAL(3,1) NOT NULL CHECK (credit_hours > 0 and credit_hours <= 3),
    program VARCHAR(10) NOT NULL,
    allocation_availability INTEGER NOT NULL 
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
    program VARCHAR(10) NOT NULL,
    section INTEGER NOT NULL CHECK (section > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, day_id, slot_id),
    UNIQUE(teacher_id, day_id, slot_id)
);

-- Create Routine Table
CREATE TABLE routine (
    routine_id SERIAL PRIMARY KEY,
    day_id INTEGER REFERENCES days(day_id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES time_slots(slot_id) ON DELETE CASCADE,
    course_code VARCHAR(20),
    room_number VARCHAR(10),
    teacher_name VARCHAR(100),
    UNIQUE(day_id, slot_id, room_number)
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
    ('08:00:00', '09:15:00', 1),
    ('09:15:00', '10:30:00', 2),
    ('10:30:00', '11:45:00', 3),
    ('11:45:00', '13:00:00', 4);

-- Insert rooms with capacity and lab status
INSERT INTO rooms (room_number, capacity, is_lab) VALUES
    ('301', 60, false),
    ('302', 60, false),
    ('304', 60, false),
    ('508', 60, false),  
    ('510', 60, false),
    ('L-1', 30, True), 
    ('L-2', 30, True);  

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

-- Function to generate routine from allocations
CREATE OR REPLACE FUNCTION generate_routine()
RETURNS void AS $$
BEGIN
    -- Clear existing routine
    TRUNCATE TABLE routine;
    
    -- Insert new routine data from allocations
    INSERT INTO routine (day_id, slot_id, course_code, room_number, teacher_name)
    SELECT 
        a.day_id,
        a.slot_id,
        c.course_code,
        r.room_number,
        t.name as teacher_name
    FROM allocations a
    JOIN courses c ON a.course_id = c.course_id
    JOIN rooms r ON a.room_id = r.room_id
    JOIN teachers t ON a.teacher_id = t.teacher_id
    ORDER BY a.day_id, a.slot_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update routine when allocations change
CREATE OR REPLACE FUNCTION update_routine_on_allocation_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate new routine
    PERFORM generate_routine();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for allocation changes
DROP TRIGGER IF EXISTS allocation_changes_update_routine ON allocations;
CREATE TRIGGER allocation_changes_update_routine
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_routine_on_allocation_change();

-- Function to get formatted routine
CREATE OR REPLACE FUNCTION get_formatted_routine()
RETURNS TABLE (
    day_name VARCHAR(10),
    time_slot TEXT,
    course_code VARCHAR(20),
    room_number VARCHAR(10),
    teacher_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.day_name,
        CONCAT(TO_CHAR(ts.start_time, 'HH24:MI'), ' - ', TO_CHAR(ts.end_time, 'HH24:MI')) as time_slot,
        r.course_code,
        r.room_number,
        r.teacher_name
    FROM routine r
    JOIN days d ON r.day_id = d.day_id
    JOIN time_slots ts ON r.slot_id = ts.slot_id
    ORDER BY d.day_order, ts.slot_order;
END;
$$ LANGUAGE plpgsql;

-- Insert sample teachers
INSERT INTO teachers (name, email) VALUES
    ('Dr. John Smith', 'john.smith@university.edu'),
    ('Prof. Amanda White', 'amanda.white@university.edu');

-- Insert sample courses
INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability) VALUES
    -- Computer Science Courses
    ('CSE 1101', 'Introduction to Programming', 3.0, 'CSE', 2),
    -- Software Engineering Courses
    ('SWE 1101', 'Software Development Fundamentals', 3.0, 'SWE', 1),
    -- Electrical Engineering Courses
    ('EEE 1101', 'Basic Electrical Engineering', 3.0, 'EEE', 3),
    -- Mechanical Engineering Courses
    ('ME 1101', 'Engineering Mechanics', 3.0, 'ME', 2),
    -- Industrial Engineering Courses
    ('IPE 1101', 'Industrial Process', 1.5, 'IPE', 1),
    -- Civil Engineering Courses
    ('CEE 1101', 'Structural Analysis', 3.0, 'CEE', 2),
    -- Business Technology Management Courses
    ('BTM 1101', 'Business Analytics', 1.5, 'BTM', 1);

-- Function to check section allocation availability
CREATE OR REPLACE FUNCTION get_available_sections(p_course_id INTEGER)
RETURNS TABLE (
    section_number INTEGER,
    allocations_count BIGINT,
    max_allocations INTEGER
) AS $$
DECLARE
    course_credits DECIMAL;
    max_slots INTEGER;
BEGIN
    -- Get course credits
    SELECT credit_hours INTO course_credits
    FROM courses
    WHERE course_id = p_course_id;

    -- Calculate max slots per section (credit_hours / 1.5)
    max_slots := CEIL(course_credits / 1.5);

    -- Get allocation counts for each section using CUBE for advanced aggregation
    RETURN QUERY
    WITH section_counts AS (
        SELECT 
            section,
            COUNT(*) as allocation_count
        FROM allocations
        WHERE course_id = p_course_id
        GROUP BY CUBE(section)
    ),
    program_sections AS (
        SELECT 
            generate_series(1, 
                CASE 
                    WHEN c.program = 'CSE' THEN 2
                    WHEN c.program = 'SWE' THEN 1
                    WHEN c.program = 'EEE' THEN 3
                    WHEN c.program = 'ME' THEN 2
                    WHEN c.program = 'IPE' THEN 1
                    WHEN c.program = 'CEE' THEN 3
                    WHEN c.program = 'BTM' THEN 1
                    ELSE 0
                END
            ) as section_number
        FROM courses c
        WHERE c.course_id = p_course_id
    )
    SELECT 
        ps.section_number,
        COALESCE(sc.allocation_count, 0),
        max_slots
    FROM program_sections ps
    LEFT JOIN section_counts sc ON ps.section_number = sc.section
    WHERE COALESCE(sc.allocation_count, 0) < max_slots;

END;
$$ LANGUAGE plpgsql;

-- Trigger function to check section allocation limit
CREATE OR REPLACE FUNCTION check_section_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_slots INTEGER;
    course_credits DECIMAL;
BEGIN
    -- Get course credits
    SELECT credit_hours INTO course_credits
    FROM courses
    WHERE course_id = NEW.course_id;

    -- Calculate max slots
    max_slots := CEIL(course_credits / 1.5);

    -- Get current allocation count for this section
    SELECT COUNT(*)
    INTO current_count
    FROM allocations
    WHERE course_id = NEW.course_id
    AND section = NEW.section;

    IF current_count >= max_slots THEN
        RAISE EXCEPTION 'Section % has reached maximum allocation limit of % slots', 
            NEW.section, max_slots;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_section_allocation_limit_trigger ON allocations;
CREATE TRIGGER check_section_allocation_limit_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_section_allocation_limit();
