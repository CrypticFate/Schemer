-- Drop tables if they exist (consider order for foreign keys)
DROP TABLE IF EXISTS allocation_logs; -- From trigger.sql if you added it
DROP TABLE IF EXISTS routine;
DROP TABLE IF EXISTS allocations;
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
    allocation_availability INTEGER NOT NULL,
    course_type VARCHAR(10) NOT NULL CHECK (course_type IN ('Theory', 'Lab')) -- Added course_type
);

-- Rooms Table
CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    is_lab BOOLEAN DEFAULT false NOT NULL -- Ensure NOT NULL
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
    slot_order INTEGER NOT NULL, -- Order might be less meaningful across types
    slot_type VARCHAR(10) NOT NULL CHECK (slot_type IN ('Theory', 'Lab')), -- Added slot_type
    UNIQUE(start_time, end_time, slot_type), -- Unique combination including type
    CHECK(end_time > start_time)
);

-- Allocations Table
CREATE TABLE allocations (
    allocation_id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(room_id) ON DELETE CASCADE,
    day_id INTEGER REFERENCES days(day_id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES time_slots(slot_id) ON DELETE CASCADE, -- Still references the single time_slots table
    program VARCHAR(10) NOT NULL,
    section INTEGER NOT NULL CHECK (section > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, day_id, slot_id), -- Room cannot be double booked for any type of slot
    UNIQUE(teacher_id, day_id, slot_id) -- Teacher cannot be double booked for any type of slot
    -- Note: A teacher *could* teach a theory and lab at the same numerical time if days differ,
    -- but not at the exact same day/slot_id combination.
);

-- Create Routine Table (Optional but used by existing functions)
CREATE TABLE routine (
    routine_id SERIAL PRIMARY KEY,
    day_id INTEGER REFERENCES days(day_id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES time_slots(slot_id) ON DELETE CASCADE,
    course_code VARCHAR(20),
    room_number VARCHAR(10),
    teacher_name VARCHAR(100),
    program VARCHAR(10) NOT NULL,
    section INTEGER NOT NULL CHECK (section > 0),
    UNIQUE(program, section, day_id, slot_id) -- Ensure unique entry per section slot
    -- Removed UNIQUE(day_id, slot_id, room_number) as different sections can use same room/slot
);


-- Insert initial data

-- Insert days
INSERT INTO days (day_name, day_order) VALUES
    ('Monday', 1),
    ('Tuesday', 2),
    ('Wednesday', 3),
    ('Thursday', 4),
    ('Friday', 5);

-- Insert time slots (THEORY)
INSERT INTO time_slots (start_time, end_time, slot_order, slot_type) VALUES
    ('08:00:00', '09:15:00', 1, 'Theory'),
    ('09:15:00', '10:30:00', 2, 'Theory'),
    ('10:30:00', '11:45:00', 3, 'Theory'),
    ('11:45:00', '13:00:00', 4, 'Theory');

-- Insert time slots (LAB)
INSERT INTO time_slots (start_time, end_time, slot_order, slot_type) VALUES
    ('08:00:00', '10:30:00', 5, 'Lab'), -- Slot order continues or resets, adjust as needed
    ('10:30:00', '13:00:00', 6, 'Lab'),
    ('14:30:00', '17:00:00', 7, 'Lab'); -- Afternoon lab slot

-- Insert rooms with capacity and lab status
INSERT INTO rooms (room_number, capacity, is_lab) VALUES
    ('301', 60, false),
    ('302', 60, false),
    ('304', 55, false), -- Example capacity variation
    ('508', 50, false),
    ('510', 40, false),
    ('L-1', 30, true),  -- Marked as Lab
    ('L-2', 30, true);  -- Marked as Lab

-- Insert sample teachers
INSERT INTO teachers (name, email) VALUES
    ('Dr. John Smith', 'john.smith@university.edu'),
    ('Prof. Jane Doe', 'jane.doe@university.edu'),
    ('Mr. Lab Assistant', 'lab.assist@university.edu'),
    ('Prof. Amanda White', 'amanda.white@university.edu');

-- Insert sample courses (Assigning course_type based on convention or actual type)
-- Assuming even codes ending in 0, 2, 4, 6, 8 are Labs for these examples
INSERT INTO courses (course_code, course_name, credit_hours, program, allocation_availability, course_type) VALUES
    ('CSE 1101', 'Introduction to Programming', 3.0, 'CSE', 4, 'Theory'), -- Odd code -> Theory
    ('CSE 1102', 'Programming Lab', 1.5, 'CSE', 2, 'Lab'), -- Even code -> Lab (1.5 credit lab likely 1 slot)
    ('SWE 1101', 'Software Development Fundamentals', 3.0, 'SWE', 1, 'Theory'),
    ('EEE 1101', 'Basic Electrical Engineering', 3.0, 'EEE', 6, 'Theory'),
    ('EEE 1102', 'Basic Electrical Engineering Lab', 1.5, 'EEE', 3, 'Lab'),
    ('ME 1101', 'Engineering Mechanics', 3.0, 'ME', 4, 'Theory'),
    ('IPE 1101', 'Industrial Process', 1.5, 'IPE', 1, 'Theory'), -- Assuming 1.5 Theory exists
    ('IPE 1102', 'Manufacturing Lab', 1.5, 'IPE', 1, 'Lab'),
    ('CEE 1101', 'Structural Analysis', 3.0, 'CEE', 6, 'Theory'),
    ('BTM 1101', 'Business Analytics', 1.5, 'BTM', 1, 'Theory');


-- Drop existing function if exists to redefine
DROP FUNCTION IF EXISTS get_available_rooms(INTEGER, INTEGER, VARCHAR);

-- Function to get available rooms for a given day, time slot, AND COURSE TYPE
CREATE OR REPLACE FUNCTION get_available_rooms(p_day_id INTEGER, p_slot_id INTEGER, p_course_type VARCHAR)
RETURNS TABLE (
    room_id INTEGER,
    room_number VARCHAR(10),
    capacity INTEGER,
    is_lab BOOLEAN
) AS $$
DECLARE
    v_is_lab_required BOOLEAN;
BEGIN
    -- Determine if a lab room is required based on course type
    v_is_lab_required := (p_course_type = 'Lab');

    -- Validate day_id and slot_id (optional but good practice)
    IF NOT EXISTS (SELECT 1 FROM days WHERE day_id = p_day_id) THEN
        RAISE EXCEPTION 'Invalid day_id: %', p_day_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM time_slots WHERE slot_id = p_slot_id) THEN
        RAISE EXCEPTION 'Invalid slot_id: %', p_slot_id;
    END IF;

    -- Return available rooms matching the lab requirement
    RETURN QUERY
    SELECT r.room_id, r.room_number, r.capacity, r.is_lab
    FROM rooms r
    WHERE r.is_lab = v_is_lab_required -- Filter by lab/non-lab
    AND NOT EXISTS ( -- Check if room is already allocated for this specific day/slot
        SELECT 1
        FROM allocations a
        WHERE a.room_id = r.room_id
        AND a.day_id = p_day_id
        AND a.slot_id = p_slot_id
    )
    ORDER BY r.room_number;
END;
$$ LANGUAGE plpgsql;


-- Function to generate routine from allocations (No change needed, reads from allocations)
CREATE OR REPLACE FUNCTION generate_routine()
RETURNS void AS $$
BEGIN
    TRUNCATE TABLE routine RESTART IDENTITY; -- Clear existing routine safely
    INSERT INTO routine (day_id, slot_id, course_code, room_number, teacher_name, program, section)
    SELECT
        a.day_id,
        a.slot_id,
        c.course_code,
        r.room_number,
        t.name as teacher_name,
        a.program,
        a.section
    FROM allocations a
    JOIN courses c ON a.course_id = c.course_id
    JOIN rooms r ON a.room_id = r.room_id
    JOIN teachers t ON a.teacher_id = t.teacher_id
    ORDER BY a.day_id, a.slot_id; -- Order is good practice but not strictly necessary for the table
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update routine when allocations change (No change needed)
CREATE OR REPLACE FUNCTION update_routine_on_allocation_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM generate_routine();
    RETURN NULL; -- For AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS allocation_changes_update_routine ON allocations;
-- Create trigger for allocation changes
CREATE TRIGGER allocation_changes_update_routine
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH STATEMENT -- Important: run once per statement, not per row for efficiency
    EXECUTE FUNCTION update_routine_on_allocation_change();


-- Function to get formatted routine (No change needed, reads from generated routine)
CREATE OR REPLACE FUNCTION get_formatted_routine(selProgram TEXT, selSection INT)
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
        -- Format time based on the joined time_slots table
        CONCAT(TO_CHAR(ts.start_time, 'HH24:MI'), ' - ', TO_CHAR(ts.end_time, 'HH24:MI')) as time_slot,
        r.course_code,
        r.room_number,
        r.teacher_name
    FROM routine r
    JOIN days d ON r.day_id = d.day_id
    JOIN time_slots ts ON r.slot_id = ts.slot_id -- Join with time_slots to get times
    WHERE r.program = selProgram AND r.section = selSection
    ORDER BY d.day_order, ts.slot_order; -- Order using original tables' order columns
END;
$$ LANGUAGE plpgsql;


-- Function to check section allocation availability (Adjust logic if labs have different slot counts per credit)
CREATE OR REPLACE FUNCTION get_available_sections(p_course_id INTEGER)
RETURNS TABLE (
    section_number INTEGER,
    allocations_count BIGINT,
    max_allocations INTEGER -- Represents the number of time slots needed
) AS $$
DECLARE
    course_rec RECORD;
    max_slots INTEGER;
    expected_sections INTEGER;
BEGIN
    -- Get course details
    SELECT credit_hours, program, course_type INTO course_rec
    FROM courses
    WHERE course_id = p_course_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Course with ID % not found.', p_course_id;
    END IF;

    -- Calculate max slots per section needed
    -- Simple Logic: Assume 1.5 credits = 1 slot, 3 credits = 2 slots, regardless of Theory/Lab
    -- Refine this if Lab credits translate differently to required slots (e.g., a 1.5 credit lab might still be one 2.5hr slot)
    max_slots := CEIL(course_rec.credit_hours / 1.5);
    -- Example Refinement:
    -- IF course_rec.course_type = 'Lab' AND course_rec.credit_hours = 1.5 THEN
    --    max_slots := 1; -- 1.5 credit lab needs one lab slot
    -- ELSIF course_rec.course_type = 'Lab' AND course_rec.credit_hours = 3.0 THEN
    --    max_slots := 2; -- 3 credit lab needs two lab slots (unlikely?)
    -- ELSE -- Theory
    --    max_slots := CEIL(course_rec.credit_hours / 1.5);
    -- END IF;


    -- Determine expected number of sections based on program
    SELECT CASE course_rec.program
               WHEN 'CSE' THEN 2
               WHEN 'SWE' THEN 1
               WHEN 'EEE' THEN 3
               WHEN 'ME' THEN 2
               WHEN 'IPE' THEN 1 -- Assuming 1 section for IPE Theory and 1 for IPE Lab
               WHEN 'CEE' THEN 3
               WHEN 'BTM' THEN 1
               ELSE 0
           END
    INTO expected_sections;

    -- Get allocation counts for each potential section
    RETURN QUERY
    WITH section_counts AS (
        SELECT
            a.section,
            COUNT(*) as allocation_count
        FROM allocations a
        WHERE a.course_id = p_course_id
        GROUP BY a.section
    ),
    program_sections AS (
        SELECT generate_series(1, expected_sections) as section_number
    )
    SELECT
        ps.section_number,
        COALESCE(sc.allocation_count, 0)::BIGINT, -- Cast for type matching
        max_slots::INTEGER -- Cast for type matching
    FROM program_sections ps
    LEFT JOIN section_counts sc ON ps.section_number = sc.section
    WHERE COALESCE(sc.allocation_count, 0) < max_slots; -- Only return sections needing more slots

END;
$$ LANGUAGE plpgsql;


-- Trigger function to check section allocation limit (Uses logic from get_available_sections)
CREATE OR REPLACE FUNCTION check_section_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_slots INTEGER;
    course_rec RECORD;
BEGIN
    -- Get course credits and type
    SELECT credit_hours, course_type INTO course_rec
    FROM courses
    WHERE course_id = NEW.course_id;

    -- Calculate max slots (using the same logic as get_available_sections)
    max_slots := CEIL(course_rec.credit_hours / 1.5);
    -- Apply refinement here too if needed based on course_type


    -- Get current allocation count for this specific course and section
    SELECT COUNT(*)
    INTO current_count
    FROM allocations
    WHERE course_id = NEW.course_id
    AND section = NEW.section;

    -- Check if adding this allocation would exceed the limit
    -- Note: The check is BEFORE insert, so current_count doesn't include the NEW row yet.
    IF current_count >= max_slots THEN
        RAISE EXCEPTION 'Section % for course % has reached maximum allocation limit of % slots',
            NEW.section, NEW.course_id, max_slots;
    END IF;

    RETURN NEW; -- Allow the insert
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS check_section_allocation_limit_trigger ON allocations;
-- Create trigger
CREATE TRIGGER check_section_allocation_limit_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_section_allocation_limit();

-- Add relevant triggers from trigger.sql (Workload, Availability Check)
-- Ensure these triggers exist and are correct based on the final schema

-- Teacher Workload Trigger
DROP TRIGGER IF EXISTS check_teacher_workload_trigger ON allocations;
CREATE TRIGGER check_teacher_workload_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_teacher_workload(); -- Assume check_teacher_workload is defined correctly elsewhere

-- Course Availability Trigger
DROP TRIGGER IF EXISTS trg_check_course_allocation ON allocations;
CREATE TRIGGER trg_check_course_allocation
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_course_allocation_availability(); -- Assume function is defined correctly