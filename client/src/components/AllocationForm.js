import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Form, Button, Alert, Row, Col, Spinner, Badge } from "react-bootstrap";

// Logging helper for frontend (optional, but useful for debugging)
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [AllocationForm] ${message}`, data !== null ? data : '');
}

// Keep onAllocationCreated prop even if reloading, for flexibility
const AllocationForm = ({ onAllocationCreated }) => {
    // --- State Variables ---
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [days, setDays] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [error, setError] = useState("");
    const [workloadWarning, setWorkloadWarning] = useState("");
    const [success, setSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const [formData, setFormData] = useState({
        teacher_id: "", course_id: "", room_id: "", day_id: "", slot_id: "",
    });

    const [isAllocated, setIsAllocated] = useState(false);
    const [program, setProgram] = useState("");
    const [section, setSection] = useState("");
    const [courseType, setCourseType] = useState("");

    // Dynamic options arrays - Initialized as empty arrays
    const [availableSections, setAvailableSections] = useState([]);
    const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
    const [availableDays, setAvailableDays] = useState([]);

    // Loading states
    const [loadingSections, setLoadingSections] = useState(false);
    const [loadingDays, setLoadingDays] = useState(false);
    const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(false);

    // --- Fetch Initial Data ---
    const loadInitialData = async () => {
        setLoadingData(true);
        try {
            const [teachersRes, coursesRes, daysRes] = await Promise.all([
                axios.get("http://localhost:5000/api/teachers"),
                axios.get("http://localhost:5000/api/courses"),
                axios.get("http://localhost:5000/api/days"),
            ]);
            setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : []);
            setCourses(Array.isArray(coursesRes.data) ? coursesRes.data.filter(c => c.allocation_availability > 0) : []);
            setDays(Array.isArray(daysRes.data) ? daysRes.data : []);
            setError("");
        } catch (err) {
            setError("Error loading initial data. Please try refreshing.");
            log("ERROR","Initial data load error:", err);
            setTeachers([]); setCourses([]); setDays([]);
        } finally {
            setLoadingData(false);
        }
    };

    // --- Fetch Course Data ---
     const fetchCourseData = useCallback(async (courseId) => {
        if (!courseId) return;
        setProgram(""); setCourseType(""); setAvailableSections([]); setSection("");
        setFormData(prev => ({ ...prev, teacher_id: '', day_id: '', slot_id: '', room_id: '' }));
        setAvailableDays([]); setAvailableTimeSlots([]); setAvailableRooms([]); setIsAllocated(false);
        setError(''); setWorkloadWarning(''); setSuccess('');
        setLoadingSections(true);
        try {
            const courseDetailsRes = await axios.get(`http://localhost:5000/api/courses/${courseId}`);
            const courseData = courseDetailsRes.data;
            if (courseData) {
                setProgram(courseData.program);
                setCourseType(courseData.course_type);
                 const teacherRes = await axios.get(`http://localhost:5000/api/get-teacher-by-course/${courseId}`);
                 const teacherName = teacherRes.data.teacher_name;
                 if (teacherName) {
                     const teacher = Array.isArray(teachers) ? teachers.find((t) => t.name === teacherName) : null;
                     if (teacher) {
                         setFormData((prev) => ({ ...prev, teacher_id: teacher.teacher_id }));
                         setIsAllocated(true);
                     } else { setIsAllocated(false); }
                 } else { setIsAllocated(false); }
                const sectionsResponse = await axios.get(`http://localhost:5000/api/courses/${courseId}/available-sections`);
                if (Array.isArray(sectionsResponse.data)) {
                    setAvailableSections(sectionsResponse.data);
                } else {
                    log("ERROR", "API did not return an array for available sections:", sectionsResponse.data);
                    setAvailableSections([]); setError("Failed to load valid section data.");
                }
            } else { throw new Error("Course details not found"); }
        } catch (err) {
            setError("Error loading course data."); log("ERROR","Error fetching course data:", err);
             setProgram(""); setCourseType(""); setAvailableSections([]);
        } finally { setLoadingSections(false); }
    }, [teachers]);

    // --- Fetch Available Days ---
    const fetchAvailableDays = useCallback(async (courseId, selectedSection) => {
        if (!courseId || !selectedSection) return;
        log("DEBUG",`FETCH_DAYS_START: course ${courseId}, section ${selectedSection}`);
        setLoadingDays(true); setAvailableDays([]); setError('');
        try {
            const response = await axios.get(`http://localhost:5000/api/available-days`, { params: { course_id: courseId, section: selectedSection } });
            log("DEBUG","FETCH_DAYS_SUCCESS:", response.data);
            if (Array.isArray(response.data)) { setAvailableDays(response.data); }
            else { log("ERROR","FETCH_DAYS_INVALID_DATA:", response.data); setAvailableDays([]); setError("Failed to load valid day data."); }
        } catch (err) {
            log("ERROR","FETCH_DAYS_ERROR:", err.response?.data || err.message); setError("Error loading available days."); setAvailableDays([]);
        } finally { log("DEBUG","FETCH_DAYS_FINALLY: Setting loadingDays to false"); setLoadingDays(false); }
    }, []);

    // --- Fetch Available Time Slots ---
    const fetchAvailableTimeSlots = useCallback(async (dayId, selectedSection, selectedProgram, courseId) => {
        if (!dayId || !selectedSection || !selectedProgram || !courseId ) return;
        setLoadingTimeSlots(true); setAvailableTimeSlots([]);
        setFormData(prev => ({ ...prev, slot_id: '', room_id: '' })); setAvailableRooms([]);
        try {
            const response = await axios.get("http://localhost:5000/api/available-time-slots", { params: { day_id: dayId, section: selectedSection, program: selectedProgram, course_id: courseId } });
             if (Array.isArray(response.data)) { setAvailableTimeSlots(response.data); }
             else { log("ERROR","API did not return an array for available time slots:", response.data); setAvailableTimeSlots([]); setError("Failed to load valid time slot data."); }
        } catch (err) {
            setError("Error loading available time slots."); log("ERROR","Error fetching time slots:", err); setAvailableTimeSlots([]);
        } finally { setLoadingTimeSlots(false); }
    }, []);

    // --- Fetch Available Rooms ---
     const loadAvailableRooms = useCallback(async (dayId, slotId, type) => {
        if (!dayId || !slotId || !type) return;
        setLoadingRooms(true); setAvailableRooms([]);
        setFormData(prev => ({ ...prev, room_id: '' }));
        try {
            const response = await axios.get(`http://localhost:5000/api/room-availability`, { params: { day_id: dayId, slot_id: slotId, course_type: type } });
             if (Array.isArray(response.data)) { setAvailableRooms(response.data); }
             else { log("ERROR", "API did not return an array for available rooms:", response.data); setAvailableRooms([]); setError("Failed to load valid room data."); }
        } catch (err) {
            setError("Error loading available rooms"); log("ERROR", "Error loading rooms:", err); setAvailableRooms([]);
        } finally { setLoadingRooms(false); }
    }, []);

    // --- Effects ---
    useEffect(() => { loadInitialData(); }, []);
    useEffect(() => { fetchCourseData(formData.course_id); }, [formData.course_id, fetchCourseData]);
    useEffect(() => {
        log("DEBUG",`EFFECT_SECTION_CHANGE: course_id=${formData.course_id}, section=${section}`);
        if (formData.course_id && section) { fetchAvailableDays(formData.course_id, section); }
        else { setAvailableDays([]); if (loadingDays) { log("DEBUG","EFFECT_SECTION_CHANGE: Clearing stuck loadingDays state."); setLoadingDays(false); } }
     }, [section, formData.course_id, fetchAvailableDays]);
    useEffect(() => {
        if (formData.day_id && section && program && formData.course_id) { fetchAvailableTimeSlots(formData.day_id, section, program, formData.course_id); }
        else { setAvailableTimeSlots([]); }
    }, [formData.day_id, section, program, formData.course_id, fetchAvailableTimeSlots]);
    useEffect(() => {
        if (formData.day_id && formData.slot_id && courseType) { loadAvailableRooms(formData.day_id, formData.slot_id, courseType); }
        else { setAvailableRooms([]); }
    }, [formData.day_id, formData.slot_id, courseType, loadAvailableRooms]);

    // --- Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let resetFields = {};
        if (name === 'course_id') {
            resetFields = { teacher_id: '', day_id: '', slot_id: '', room_id: '' };
            setSection(''); setProgram(''); setCourseType(''); setAvailableSections([]); setAvailableDays([]); setAvailableTimeSlots([]); setAvailableRooms([]); setIsAllocated(false);
        } else if (name === 'section') { return; }
        else if (name === 'day_id') { resetFields = { slot_id: '', room_id: '' }; setAvailableTimeSlots([]); setAvailableRooms([]); }
        else if (name === 'slot_id') { resetFields = { room_id: '' }; setAvailableRooms([]); }
        setFormData((prev) => ({ ...prev, [name]: value, ...resetFields }));
        setError(""); setWorkloadWarning(""); setSuccess("");
    };
    const handleSectionChange = (e) => {
        const selectedValue = e.target.value;
        log("DEBUG","HANDLE_SECTION_CHANGE: New section selected:", selectedValue);
        setSection(selectedValue);
        setFormData((prev) => ({ ...prev, day_id: "", slot_id: "", room_id: "" }));
        setAvailableDays([]); setAvailableTimeSlots([]); setAvailableRooms([]);
        setError(""); setWorkloadWarning(""); setSuccess("");
    };
    const resetForm = () => {
        setFormData({ teacher_id: "", course_id: "", room_id: "", day_id: "", slot_id: "" });
        setProgram(""); setSection(""); setCourseType(""); setSuccess(""); setError(""); setWorkloadWarning(""); setIsAllocated(false); setAvailableSections([]); setAvailableDays([]); setAvailableTimeSlots([]); setAvailableRooms([]);
    };
    const formatWorkloadError = (errorMessage) => { return errorMessage; };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true); setError(""); setWorkloadWarning(""); setSuccess("");
        const submissionData = { ...formData, program, section: parseInt(section, 10) };

        if (!submissionData.teacher_id || !submissionData.course_id || !submissionData.room_id || !submissionData.day_id || !submissionData.slot_id || !submissionData.program || isNaN(submissionData.section)) {
             setError("Please fill in all fields before submitting."); setIsSubmitting(false); return;
        }

        try {
            log("DEBUG", "Form Submit: Sending data", submissionData);
            const response = await axios.post("http://localhost:5000/api/allocations", submissionData);
            log("DEBUG", "Form Submit: Success Response", response.data);

            setSuccess("Allocation created successfully! Reloading..."); // Updated message
            resetForm();

            // Call parent callback if provided
            if (onAllocationCreated) {
                log("DEBUG", "Form Submit: Calling onAllocationCreated");
                onAllocationCreated();
            }

            // *** ADDED: Reload the page after a short delay ***
            setTimeout(() => {
                window.location.reload();
            }, 1500); // Delay in milliseconds (e.g., 1.5 seconds)


        } catch (err) {
            console.error("Allocation Submission Error:", err.response || err);
            const serverErrorMessage = err.response?.data?.error || "An unexpected error occurred. Please check console or try again.";
            log("ERROR", "Form Submit: Error received", { status: err.response?.status, message: serverErrorMessage });

             if (err.response?.status === 409 || serverErrorMessage.includes("workload")) {
                 setWorkloadWarning(serverErrorMessage);
             } else {
                setError(serverErrorMessage);
             }
             if (serverErrorMessage.includes("Teacher already booked")) {
                 setFormData((prev) => ({ ...prev, day_id: '', slot_id: '', room_id: '' }));
                 setAvailableTimeSlots([]); setAvailableRooms([]);
             }
        } finally {
             // Set submitting false just before potential reload starts
             setIsSubmitting(false);
        }
     };

    const getSectionOptions = () => {
         if (!program || !Array.isArray(availableSections) || availableSections.length === 0) { return []; }
         return availableSections.map((s) => ({
             number: s.section_number.toString(),
             remaining: s.max_allocations - s.allocations_count
         }));
     };

    // --- Render Logic ---
    return (
        <div className="mt-4 smaller-text">
            <h3>Create Allocation</h3>
            {loadingData && <Alert variant="info"><Spinner animation="border" size="sm" /> Loading initial data...</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}
            {workloadWarning && <Alert variant="warning">{workloadWarning}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Form onSubmit={handleSubmit}>
                {/* Progress Bar */}
                <div className="allocation-progress mb-4">
                     <div className={`progress-step ${formData.course_id ? "completed" : ""}`} />
                     <div className={`progress-step ${formData.teacher_id ? "completed" : ""}`} />
                     <div className={`progress-step ${section ? "completed" : ""}`} />
                     <div className={`progress-step ${formData.day_id ? "completed" : ""}`} />
                     <div className={`progress-step ${formData.slot_id ? "completed" : ""}`} />
                     <div className={`progress-step ${formData.room_id ? "completed" : ""}`} />
                </div>

                {/* Form Rows */}
                <Row> {/* Course / Program */}
                    <Col md={7}>
                        <Form.Group className="mb-3">
                            <Form.Label>Course</Form.Label>
                            <Form.Select name="course_id" value={formData.course_id} onChange={handleInputChange} required disabled={loadingData || isSubmitting}>
                                <option value="">Select Course</option>
                                {Array.isArray(courses) && courses.map((course) => ( <option key={course.course_id} value={course.course_id}> {course.course_code} - {course.course_name.slice(0, 30)} ({course.course_type}) </option> ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={5}>
                         <Form.Group className="mb-3">
                            <Form.Label>Program</Form.Label>
                            <Form.Control type="text" value={program} readOnly placeholder="Select a course" className="bg-light" />
                        </Form.Group>
                    </Col>
                </Row>
                 {/* Course Type Display */}
                 <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label className="fw-bold">Course Type </Form.Label>
                            <Form.Control
                                type="text"
                                value={courseType || 'Select Course first'}
                                readOnly
                                disabled
                                className="bg-light"
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}></Col>
                 </Row>

                <Row> {/* Teacher Row */}
                     <Col md={7}>
                        <Form.Group className="mb-3">
                             <Form.Label>Teacher</Form.Label>
                            {isAllocated ? (
                                <Form.Control type="text" value={ Array.isArray(teachers) ? (teachers.find(t => t.teacher_id === formData.teacher_id)?.name || '...') : '...' } readOnly className="bg-light" />
                            ) : (
                                <Form.Select name="teacher_id" value={formData.teacher_id} onChange={handleInputChange} required disabled={!formData.course_id || isSubmitting} >
                                    <option value=""> {!formData.course_id ? "Select course first" : "Select teacher"} </option>
                                    {Array.isArray(teachers) && teachers.map((teacher) => ( <option key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.name}</option> ))}
                                </Form.Select>
                            )}
                        </Form.Group>
                    </Col>
                    <Col md={5}></Col>
                </Row>
                 <Row> {/* Section / Day */}
                    <Col md={6}>
                         <Form.Group className="mb-3">
                            <Form.Label>Section {loadingSections && formData.course_id && <Spinner animation="border" size="sm" />}</Form.Label>
                            <Form.Select value={section} onChange={handleSectionChange} disabled={!program || getSectionOptions().length === 0 || loadingSections || isSubmitting} required >
                                <option value="">{!program ? "Select course" : (getSectionOptions().length === 0 && !loadingSections ? "No sections available" : "Select Section")}</option>
                                {getSectionOptions().map((sec) => ( <option key={sec.number} value={sec.number}> Section {sec.number} ({sec.remaining} slot{sec.remaining !== 1 ? 's' : ''} needed) </option> ))}
                             </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                             <Form.Label>Day {loadingDays && <Spinner animation="border" size="sm" />}</Form.Label>
                             <Form.Select name="day_id" value={formData.day_id} onChange={handleInputChange} required disabled={!section || loadingDays || availableDays.length === 0 || isSubmitting} >
                                <option value="">
                                    {!section ? "Select section first" :
                                    loadingDays ? "Loading days..." :
                                    availableDays.length === 0 ? "No available days" :
                                    "Select Day"}
                                </option>
                                {!loadingDays && Array.isArray(days) && Array.isArray(availableDays) && days.filter(day => availableDays.includes(day.day_id)).map((day) => (
                                    <option key={day.day_id} value={day.day_id}> {day.day_name} </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>
                <Row> {/* Time Slot / Room */}
                     <Col md={6}>
                         <Form.Group className="mb-3">
                             <Form.Label>Time Slot {loadingTimeSlots && <Spinner animation="border" size="sm" />}</Form.Label>
                            <Form.Select name="slot_id" value={formData.slot_id} onChange={handleInputChange} required disabled={!formData.day_id || loadingTimeSlots || availableTimeSlots.length === 0 || isSubmitting} >
                                <option value="">
                                     {!formData.day_id ? "Select day first" :
                                     loadingTimeSlots ? "Loading slots..." :
                                     availableTimeSlots.length === 0 ? "No available slots" :
                                     "Select Time Slot"}
                                </option>
                                {!loadingTimeSlots && Array.isArray(availableTimeSlots) && availableTimeSlots.map((slot) => ( <option key={slot.slot_id} value={slot.slot_id}> {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} ({slot.slot_type}) </option> ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                             <Form.Label>Room {loadingRooms && <Spinner animation="border" size="sm" />}</Form.Label>
                            <Form.Select name="room_id" value={formData.room_id} onChange={handleInputChange} required disabled={!formData.slot_id || loadingRooms || availableRooms.length === 0 || isSubmitting} >
                                 <option value="">
                                      {!formData.slot_id ? "Select slot first" :
                                      loadingRooms ? "Loading rooms..." :
                                      availableRooms.length === 0 ? "No available rooms" :
                                      "Select Room"}
                                 </option>
                                {!loadingRooms && Array.isArray(availableRooms) && availableRooms.map((room) => ( <option key={room.room_id} value={room.room_id}> {room.room_number} ({room.is_lab ? 'Lab' : 'Theory'}, Cap: {room.capacity}) </option> ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>

                {/* Buttons */}
                 <div className="d-flex justify-content-between mt-4">
                    <Button variant="primary" type="submit" disabled={isSubmitting || loadingData}>
                        {isSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Creating...</> : "Create Allocation"}
                    </Button>
                    <Button variant="secondary" type="button" onClick={resetForm} disabled={isSubmitting} > Reset </Button>
                 </div>
            </Form>

            {/* Styles */}
            <style jsx>{`
                /* Progress Bar Styles */
                .allocation-progress { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 20px; position: relative; height: 40px; }
                .allocation-progress::before { content: ""; position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background-color: #e9ecef; transform: translateY(-50%); z-index: 1; }
                .progress-step { width: 20px; height: 20px; border-radius: 50%; background: #e9ecef; position: relative; z-index: 2; transition: background-color 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 0 0px rgba(25, 135, 84, 0); }
                .progress-step.completed { background: #198754; box-shadow: 0 0 8px rgba(25, 135, 84, 0.6); }
                /* Other Styles */
                .bg-light[readOnly] { background-color: #e9ecef !important; opacity: 1; cursor: not-allowed; }
                .workload-error { color: #dc3545; font-weight: bold; }
            `}</style>
        </div>
    );
};

export default AllocationForm;