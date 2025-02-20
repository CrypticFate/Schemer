import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Form, Button, Alert, Row, Col, Spinner } from "react-bootstrap";

const AllocationForm = ({ onAllocationCreated }) => {
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [days, setDays] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [error, setError] = useState("");
  const [workloadWarning, setWorkloadWarning] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    teacher_id: "",
    course_id: "",
    room_id: "",
    day_id: "",
    slot_id: "",
  });

  const [isAllocated, setIsAllocated] = useState(false);

  const [program, setProgram] = useState("");
  const [section, setSection] = useState("");

  const [availableSections, setAvailableSections] = useState([]);

  // Add new state for available days
  const [availableDays, setAvailableDays] = useState([]);

  const loadAvailableRooms = useCallback(async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/room-availability`,
        {
          params: {
            day_id: formData.day_id,
            slot_id: formData.slot_id,
          },
        }
      );
      setAvailableRooms(response.data);
    } catch (err) {
      setError("Error loading available rooms");
      console.error(err);
    }
  }, [formData.day_id, formData.slot_id]);

  const fetchAllocationForCourse = useCallback(
    async (course_id, selectedSection) => {
      try {
        // Get teacher allocation first
        const response1 = await axios.get(
          `http://localhost:5000/api/get-teacher-by-course/${course_id}`
        );
        const { teacher_name } = response1.data;

        // Get course details
        const courseDetails = await axios.get(
          `http://localhost:5000/api/courses/${course_id}`
        );

        // Update program without resetting section
        if (courseDetails.data) {
          setProgram(courseDetails.data.program);
        }

        // Fetch available sections
        const sectionsResponse = await axios.get(
          `http://localhost:5000/api/courses/${course_id}/available-sections`
        );
        console.log("Fetched sections data:", sectionsResponse.data);
        setAvailableSections(sectionsResponse.data);

        // Only update teacher if it exists
        if (teacher_name) {
          const teacher = teachers.find((t) => t.name === teacher_name);
          if (teacher) {
            setFormData((prev) => ({
              ...prev,
              teacher_id: teacher.teacher_id,
            }));
            setIsAllocated(true);
          }
        }

        // Get availability
        const response2 = await axios.get(
          `http://localhost:5000/api/get-availability-by-course/${course_id}`
        );
        const { allocation_availability } = response2.data;

        if (
          allocation_availability !== undefined &&
          allocation_availability !== null
        ) {
          const availabilityText =
            allocation_availability === 0
              ? "No Slot Available"
              : allocation_availability === 1
              ? "1 Slot Available"
              : `${allocation_availability} Slots Available`;

          setFormData((prev) => ({
            ...prev,
            availability: availabilityText,
          }));
        }

        // If section is selected, fetch available days
        if (selectedSection) {
          const availableDaysResponse = await axios.get(
            `http://localhost:5000/api/available-days`,
            {
              params: {
                course_id,
                section: selectedSection
              }
            }
          );
          setAvailableDays(availableDaysResponse.data);
        }
      } catch (err) {
        console.error("Error fetching allocation for course:", err);
      }
    },
    [teachers]
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.course_id) {
      fetchAllocationForCourse(formData.course_id, section);
    }
  }, [formData.course_id, fetchAllocationForCourse, section]);

  useEffect(() => {
    if (formData.day_id && formData.slot_id) {
      loadAvailableRooms();
    }
  }, [formData.day_id, formData.slot_id, loadAvailableRooms]);

  const loadInitialData = async () => {
    try {
      const [teachersRes, coursesRes, daysRes, timeSlotsRes] =
        await Promise.all([
          axios.get("http://localhost:5000/api/teachers"),
          axios.get("http://localhost:5000/api/courses"),
          axios.get("http://localhost:5000/api/days"),
          axios.get("http://localhost:5000/api/time-slots"),
        ]);

      setTeachers(teachersRes.data);
      setCourses(coursesRes.data);
      setDays(daysRes.data);
      setTimeSlots(timeSlotsRes.data);
    } catch (err) {
      setError("Error loading initial data");
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Only reset teacher and availability when course changes
    if (name === "course_id") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        teacher_id: "",
        availability: "",
      }));
      setSection(""); // Only reset section when course changes
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    setError("");
    setWorkloadWarning("");
    setSuccess("");
  };

  const resetForm = () => {
    setFormData({
      teacher_id: "",
      course_id: "",
      room_id: "",
      day_id: "",
      slot_id: "",
    });
    setProgram("");
    setSection("");
    setSuccess("");
    setError("");
    setWorkloadWarning("");
    setIsAllocated(false);
  };

  const formatWorkloadError = (errorMessage) => {
    if (errorMessage.includes("daily workload would exceed")) {
      const matches = errorMessage.match(
        /\(Current: ([\d.]+) \+ New: ([\d.]+)\)/
      );
      if (matches) {
        const current = parseFloat(matches[1]);
        const newHours = parseFloat(matches[2]);
        return (
          <div className="workload-error">
            <strong>Daily Workload Limit Exceeded!</strong>
            <div>Current hours for this day: {current}</div>
            <div>Attempting to add: {newHours}</div>
            <div>Daily limit: 4 hours</div>
          </div>
        );
      }
    } else if (errorMessage.includes("weekly workload would exceed")) {
      const matches = errorMessage.match(
        /\(Current: ([\d.]+) \+ New: ([\d.]+)\)/
      );
      if (matches) {
        const current = parseFloat(matches[1]);
        const newHours = parseFloat(matches[2]);
        return (
          <div className="workload-error">
            <strong>Weekly Workload Limit Exceeded!</strong>
            <div>Current weekly hours: {current}</div>
            <div>Attempting to add: {newHours}</div>
            <div>Weekly limit: 13 hours</div>
          </div>
        );
      }
    }
    return errorMessage;
  };

  const handleSectionChange = (e) => {
    const selectedValue = e.target.value;
    console.log("Selected section value:", selectedValue);
    setSection(selectedValue);
    
    // Reset day selection when section changes
    setFormData(prev => ({
      ...prev,
      day_id: ""
    }));

    // Fetch available days if course is selected
    if (formData.course_id && selectedValue) {
      fetchAllocationForCourse(formData.course_id, selectedValue);
    }
    
    setError("");
    setWorkloadWarning("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setWorkloadWarning("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/allocations",
        {
          ...formData,
          program,
          section: parseInt(section, 10), // Convert to number when sending to server
        }
      );

      setSuccess("Allocation created successfully!");
      resetForm();
      if (onAllocationCreated) {
        onAllocationCreated(response.data);
      }

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Error creating allocation";
      if (errorMessage.includes("workload would exceed")) {
        setWorkloadWarning(formatWorkloadError(errorMessage));
      } else {
        setError(errorMessage);
      }
      console.error("Allocation Error:", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSectionOptions = () => {
    console.log("Current program:", program);
    console.log("Available sections:", availableSections);

    if (!program || !availableSections.length) {
      console.log("No sections available");
      return [];
    }

    return availableSections.map((s) => ({
      number: s.section_number.toString(), // Keep as string
      remaining: s.max_allocations - s.allocations_count,
    }));
  };

  return (
    <div className="mt-4 smaller-text">
      <h3>Create Allocation</h3>
      {loadingData && (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {workloadWarning && <Alert variant="warning">{workloadWarning}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Row>
          <Col md={7}>
            <Form.Group className="mb-3">
              <Form.Label>Course</Form.Label>
              <Form.Select
                name="course_id"
                value={formData.course_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_code}-{course.course_name.slice(0, 30)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={5}>
            <Form.Group className="mb-3">
              <Form.Label>Program</Form.Label>
              <Form.Control
                type="text"
                value={program}
                readOnly
                placeholder="Select a course first"
                disabled={!formData.course_id}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={7}>
            <Form.Group className="mb-3">
              <Form.Label>Teacher</Form.Label>
              {isAllocated ? (
                <Form.Control
                  type="text"
                  value={
                    teachers.find(
                      (teacher) => teacher.teacher_id === formData.teacher_id
                    )?.name || "No course selected"
                  }
                  readOnly
                  disabled={!formData.course_id}
                />
              ) : (
                <Form.Select
                  name="teacher_id"
                  value={formData.teacher_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      teacher_id: e.target.value,
                    }))
                  }
                  required
                  disabled={!formData.course_id}
                >
                  <option value="">
                    {!formData.course_id
                      ? "No Course selected"
                      : "Select a teacher"}
                  </option>
                  {teachers.map((teacher) => (
                    <option key={teacher.teacher_id} value={teacher.teacher_id}>
                      {teacher.name}
                    </option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>
          </Col>
          <Col md={5}>
            <Form.Group className="mb-3">
              <Form.Label>Availability</Form.Label>
              <Form.Control
                type="text"
                value={formData.availability || ""}
                readOnly
                placeholder="No Course selected"
                disabled={!formData.course_id}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Day</Form.Label>
              <Form.Select
                name="day_id"
                value={formData.day_id}
                onChange={handleInputChange}
                required
                disabled={!section} // Disable if no section is selected
              >
                <option value="">Select Day</option>
                {days
                  .filter(day => availableDays.includes(day.day_id))
                  .map((day) => (
                    <option key={day.day_id} value={day.day_id}>
                      {day.day_name}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Section</Form.Label>
              <Form.Select
                value={section}
                onChange={handleSectionChange}
                disabled={!program || !availableSections.length}
                required
              >
                <option value="">Select Section</option>
                {getSectionOptions().map((section) => (
                  <option key={section.number} value={section.number}>
                    Section {section.number} ({section.remaining} slots
                    remaining)
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Time Slot</Form.Label>
              <Form.Select
                name="slot_id"
                value={formData.slot_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Time Slot</option>
                {timeSlots.map((slot) => (
                  <option key={slot.slot_id} value={slot.slot_id}>
                    {slot.start_time.slice(0, -3)} -{" "}
                    {slot.end_time.slice(0, -3)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Room</Form.Label>
              <Form.Select
                name="room_id"
                value={formData.room_id}
                onChange={handleInputChange}
                required
                disabled={!formData.day_id || !formData.slot_id}
              >
                {!formData.day_id || !formData.slot_id ? (
                  <option value="">Time or Day unselected</option>
                ) : (
                  <>
                    <option value="">Select Room</option>
                    {availableRooms.map((room) => (
                      <option key={room.room_id} value={room.room_id}>
                        {room.room_number} (Capacity: {room.capacity})
                      </option>
                    ))}
                  </>
                )}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        <div className="d-flex justify-content-between">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Allocation"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Reset
          </Button>
        </div>
      </Form>
    </div>
  );
};
export default AllocationForm;
