-- Create a table to log allocation changes
CREATE TABLE IF NOT EXISTS allocation_logs (
    log_id SERIAL PRIMARY KEY,
    allocation_id INTEGER,
    teacher_id INTEGER,
    course_id INTEGER,
    room_id INTEGER,
    block_id INTEGER,
    action VARCHAR(20),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calcullating teacher workload 
CREATE OR REPLACE FUNCTION check_teacher_workload() 
RETURNS TRIGGER AS $$
DECLARE
    teacher_allocations RECORD;
    total_hours DECIMAL := 0;
    daily_hours DECIMAL := 0;
    workload_cursor CURSOR(t_id INTEGER) FOR
        SELECT c.credit_hours
        FROM allocations a
        JOIN courses c ON a.course_id = c.course_id
        WHERE a.teacher_id = t_id;
    
    daily_cursor CURSOR(t_id INTEGER, d_id INTEGER) FOR
        SELECT COALESCE(SUM(c.credit_hours), 0) as daily_total
        FROM allocations a
        JOIN courses c ON a.course_id = c.course_id
        WHERE a.teacher_id = t_id AND a.day_id = d_id;
BEGIN
    -- Check daily workload first
    OPEN daily_cursor(NEW.teacher_id, NEW.day_id);
    FETCH daily_cursor INTO daily_hours;
    CLOSE daily_cursor;
    
    -- Add new course hours to daily total
    SELECT credit_hours INTO teacher_allocations 
    FROM courses 
    WHERE course_id = NEW.course_id;
    
    IF teacher_allocations IS NULL THEN
        RAISE EXCEPTION 'Course with ID % not found', NEW.course_id;
    END IF;
    
    daily_hours := daily_hours + teacher_allocations.credit_hours;
    
    -- daily
    IF daily_hours > 4 THEN
        RAISE EXCEPTION 'Teacher daily workload would exceed 4 hours for this day (Current: % + New: %)', 
            (daily_hours - teacher_allocations.credit_hours), 
            teacher_allocations.credit_hours;
    END IF;

    -- weekly 
    total_hours := 0; 
    
    -- Get total existing hours
    SELECT COALESCE(SUM(c.credit_hours), 0) INTO total_hours
    FROM allocations a
    JOIN courses c ON a.course_id = c.course_id
    WHERE a.teacher_id = NEW.teacher_id;
    
    -- Add the new course's credit hours to weekly total
    total_hours := total_hours + teacher_allocations.credit_hours;
    
   
    IF total_hours > 13 THEN
        RAISE EXCEPTION 'Teacher weekly workload would exceed 13 hours (Current: % + New: %)', 
            (total_hours - teacher_allocations.credit_hours), 
            teacher_allocations.credit_hours;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--- Triggers to enforce allocation_availability
CREATE OR REPLACE FUNCTION check_course_allocation_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the course has any available slots
    IF (SELECT allocation_availability FROM courses WHERE course_id = NEW.course_id) <= 0 THEN
        RAISE EXCEPTION 'Cannot allocate course: No slots available for this course';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_course_allocation
BEFORE INSERT ON allocations
FOR EACH ROW
EXECUTE FUNCTION check_course_allocation_availability();


-- Create a function to check room availability using cursors
CREATE OR REPLACE FUNCTION check_room_availability() 
RETURNS TRIGGER AS $$
DECLARE
    conflicting_allocation RECORD;
BEGIN
    -- Check for existing allocation in the same room, day, and time slot
    SELECT a.allocation_id, r.room_number, c.course_name, t.name as teacher_name
    INTO conflicting_allocation
    FROM allocations a
    JOIN rooms r ON a.room_id = r.room_id
    JOIN courses c ON a.course_id = c.course_id
    JOIN teachers t ON a.teacher_id = t.teacher_id
    WHERE a.room_id = NEW.room_id 
    AND a.day_id = NEW.day_id
    AND a.slot_id = NEW.slot_id;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Room % is already allocated to % (Teacher: %) in this time slot', 
            conflicting_allocation.room_number,
            conflicting_allocation.course_name,
            conflicting_allocation.teacher_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check cross-day allocation rule
CREATE OR REPLACE FUNCTION check_cross_day_allocation() 
RETURNS TRIGGER AS $$
DECLARE
    existing_day INTEGER;
    new_day INTEGER;
    course_cursor CURSOR(c_id INTEGER) FOR
        SELECT DISTINCT tb.day_of_week
        FROM allocations a
        JOIN time_blocks tb ON a.block_id = tb.block_id
        WHERE a.course_id = c_id;
BEGIN
    -- Get the day of the new allocation
    SELECT day_of_week INTO new_day
    FROM time_blocks
    WHERE block_id = NEW.block_id;
    
    -- Check existing allocations for this course
    OPEN course_cursor(NEW.course_id);
    LOOP
        FETCH course_cursor INTO existing_day;
        EXIT WHEN NOT FOUND;
        
        IF existing_day = new_day THEN
            CLOSE course_cursor;
            RAISE EXCEPTION 'Course already has an allocation on this day (Day: %)', new_day;
        END IF;
    END LOOP;
    CLOSE course_cursor;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to log allocation changes with details
CREATE OR REPLACE FUNCTION log_allocation_changes() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO allocation_logs (
            allocation_id, teacher_id, course_id, room_id, block_id, action
        ) VALUES (
            NEW.allocation_id, NEW.teacher_id, NEW.course_id, NEW.room_id, NEW.block_id, 'INSERT'
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO allocation_logs (
            allocation_id, teacher_id, course_id, room_id, block_id, action
        ) VALUES (
            OLD.allocation_id, OLD.teacher_id, OLD.course_id, OLD.room_id, OLD.block_id, 'DELETE'
        );
    END IF;
    RETURN NULL;
END;

$$ LANGUAGE plpgsql;
-- Create triggers
DROP TRIGGER IF EXISTS check_teacher_workload_trigger ON allocations;
CREATE TRIGGER check_teacher_workload_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_teacher_workload();

DROP TRIGGER IF EXISTS check_room_availability_trigger ON allocations;
CREATE TRIGGER check_room_availability_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_room_availability();

DROP TRIGGER IF EXISTS check_cross_day_allocation_trigger ON allocations;
CREATE TRIGGER check_cross_day_allocation_trigger
    BEFORE INSERT ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION check_cross_day_allocation();

DROP TRIGGER IF EXISTS log_allocation_changes_trigger ON allocations;
CREATE TRIGGER log_allocation_changes_trigger
    AFTER INSERT OR DELETE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION log_allocation_changes();

-- Function to get detailed teacher schedule using cursor
CREATE OR REPLACE FUNCTION get_teacher_schedule(p_teacher_id INTEGER)
RETURNS TABLE (
    allocation_id INTEGER,
    course_name VARCHAR,
    course_code VARCHAR,
    credit_hours DECIMAL,
    room_number VARCHAR,
    day_of_week INTEGER,
    time_slot INTEGER
) AS $$
DECLARE
    schedule_cursor CURSOR FOR
        SELECT 
            a.allocation_id,
            c.course_name,
            c.course_code,
            c.credit_hours,
            r.room_number,
            tb.day_of_week,
            tb.time_slot
        FROM allocations a
        JOIN courses c ON a.course_id = c.course_id
        JOIN rooms r ON a.room_id = r.room_id
        JOIN time_blocks tb ON a.block_id = tb.block_id
        WHERE a.teacher_id = p_teacher_id
        ORDER BY tb.day_of_week, tb.time_slot;
    schedule_record RECORD;
BEGIN
    OPEN schedule_cursor;
    LOOP
        FETCH schedule_cursor INTO schedule_record;
        EXIT WHEN NOT FOUND;
        
        allocation_id := schedule_record.allocation_id;
        course_name := schedule_record.course_name;
        course_code := schedule_record.course_code;
        credit_hours := schedule_record.credit_hours;
        room_number := schedule_record.room_number;
        day_of_week := schedule_record.day_of_week;
        time_slot := schedule_record.time_slot;
        RETURN NEXT;
    END LOOP;
    CLOSE schedule_cursor;
END;
$$ LANGUAGE plpgsql;

-- Function to check room availability
CREATE OR REPLACE FUNCTION check_room_availability(
    p_room_id INTEGER,
    p_day_id INTEGER,
    p_slot_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    is_available BOOLEAN;
BEGIN
    SELECT ra.is_available INTO is_available
    FROM room_availability ra
    WHERE ra.room_id = p_room_id
    AND ra.day_id = p_day_id
    AND ra.slot_id = p_slot_id;
    
    RETURN COALESCE(is_available, false);
END;
$$ LANGUAGE plpgsql;

-- Function to check teacher availability
CREATE OR REPLACE FUNCTION check_teacher_availability(
    p_teacher_id INTEGER,
    p_day_id INTEGER,
    p_slot_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    existing_allocation RECORD;
BEGIN
    SELECT a.* INTO existing_allocation
    FROM allocations a
    JOIN room_availability ra ON a.availability_id = ra.availability_id
    WHERE a.teacher_id = p_teacher_id
    AND ra.day_id = p_day_id
    AND ra.slot_id = p_slot_id;
    
    RETURN existing_allocation IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check course day allocation
CREATE OR REPLACE FUNCTION check_course_day_allocation(
    p_course_id INTEGER,
    p_day_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    existing_allocation RECORD;
BEGIN
    SELECT a.* INTO existing_allocation
    FROM allocations a
    JOIN room_availability ra ON a.availability_id = ra.availability_id
    WHERE a.course_id = p_course_id
    AND ra.day_id = p_day_id;
    
    RETURN existing_allocation IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get available rooms for a time slot
CREATE OR REPLACE FUNCTION get_available_rooms(
    p_day_id INTEGER,
    p_slot_id INTEGER
) RETURNS TABLE (
    room_id INTEGER,
    room_number VARCHAR,
    capacity INTEGER,
    is_lab BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.room_id, r.room_number, r.capacity, r.is_lab
    FROM rooms r
    JOIN room_availability ra ON r.room_id = ra.room_id
    WHERE ra.day_id = p_day_id
    AND ra.slot_id = p_slot_id
    AND ra.is_available = true
    AND NOT EXISTS (
        SELECT 1 FROM allocations a
        WHERE a.availability_id = ra.availability_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get teacher's schedule
CREATE OR REPLACE FUNCTION get_teacher_schedule(
    p_teacher_id INTEGER
) RETURNS TABLE (
    day_name VARCHAR,
    start_time TIME,
    end_time TIME,
    room_number VARCHAR,
    course_name VARCHAR,
    credit_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.day_name,
        ts.start_time,
        ts.end_time,
        r.room_number,
        c.course_name,
        c.credit_hours
    FROM allocations a
    JOIN room_availability ra ON a.availability_id = ra.availability_id
    JOIN days d ON ra.day_id = d.day_id
    JOIN time_slots ts ON ra.slot_id = ts.slot_id
    JOIN rooms r ON ra.room_id = r.room_id
    JOIN courses c ON a.course_id = c.course_id
    WHERE a.teacher_id = p_teacher_id
    ORDER BY d.day_order, ts.slot_order;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate a room
CREATE OR REPLACE FUNCTION allocate_room(
    p_teacher_id INTEGER,
    p_course_id INTEGER,
    p_room_id INTEGER,
    p_day_id INTEGER,
    p_slot_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_availability_id INTEGER;
    v_allocation_id INTEGER;
BEGIN
    -- Check all conditions
    IF NOT check_room_availability(p_room_id, p_day_id, p_slot_id) THEN
        RAISE EXCEPTION 'Room is not available for this time slot';
    END IF;
    
    IF NOT check_teacher_availability(p_teacher_id, p_day_id, p_slot_id) THEN
        RAISE EXCEPTION 'Teacher is not available for this time slot';
    END IF;
    
    IF NOT check_course_day_allocation(p_course_id, p_day_id) THEN
        RAISE EXCEPTION 'Course is already allocated on this day';
    END IF;
    
    -- Get availability_id
    SELECT availability_id INTO v_availability_id
    FROM room_availability
    WHERE room_id = p_room_id
    AND day_id = p_day_id
    AND slot_id = p_slot_id;
    
    -- Create allocation
    INSERT INTO allocations (
        teacher_id,
        course_id,
        availability_id
    ) VALUES (
        p_teacher_id,
        p_course_id,
        v_availability_id
    ) RETURNING allocation_id INTO v_allocation_id;
    
    RETURN v_allocation_id;
END;
$$ LANGUAGE plpgsql;