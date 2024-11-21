import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Row, Col } from 'react-bootstrap';

const AllocationForm = ({ onAllocationCreated }) => {
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [days, setDays] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [error, setError] = useState('');
    const [workloadWarning, setWorkloadWarning] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        teacher_id: '',
        course_id: '',
        room_id: '',
        day_id: '',
        slot_id: ''
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (formData.day_id && formData.slot_id) {
            loadAvailableRooms();
        }
    }, [formData.day_id, formData.slot_id]);

    const loadInitialData = async () => {
        try {
            const [teachersRes, coursesRes, daysRes, timeSlotsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/teachers'),
                axios.get('http://localhost:5000/api/courses'),
                axios.get('http://localhost:5000/api/days'),
                axios.get('http://localhost:5000/api/time-slots')
            ]);

            setTeachers(teachersRes.data);
            setCourses(coursesRes.data);
            setDays(daysRes.data);
            setTimeSlots(timeSlotsRes.data);
        } catch (err) {
            setError('Error loading initial data');
            console.error(err);
        }
    };

    const loadAvailableRooms = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/room-availability`, {
                params: {
                    day_id: formData.day_id,
                    slot_id: formData.slot_id
                }
            });
            setAvailableRooms(response.data);
        } catch (err) {
            setError('Error loading available rooms');
            console.error(err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Reset room selection if day or slot changes
        if (name === 'day_id' || name === 'slot_id') {
            setFormData(prev => ({
                ...prev,
                room_id: ''
            }));
        }

        // Clear any previous messages
        setError('');
        setWorkloadWarning('');
        setSuccess('');
    };

    const resetForm = () => {
        setFormData({
            teacher_id: '',
            course_id: '',
            room_id: '',
            day_id: '',
            slot_id: ''
        });
        setSuccess('');
        setError('');
        setWorkloadWarning('');
    };

    const formatWorkloadError = (errorMessage) => {
        if (errorMessage.includes('daily workload would exceed')) {
            const matches = errorMessage.match(/\(Current: ([\d.]+) \+ New: ([\d.]+)\)/);
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
        } else if (errorMessage.includes('weekly workload would exceed')) {
            const matches = errorMessage.match(/\(Current: ([\d.]+) \+ New: ([\d.]+)\)/);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setWorkloadWarning('');
        setSuccess('');

        try {
            const response = await axios.post('http://localhost:5000/api/allocations', formData);
            setSuccess('Allocation created successfully!');
            resetForm();
            if (onAllocationCreated) {
                onAllocationCreated(response.data);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Error creating allocation';
            
            if (errorMessage.includes('workload would exceed')) {
                setWorkloadWarning(formatWorkloadError(errorMessage));
            } else {
                setError(errorMessage);
            }
            console.error('Allocation Error:', errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mt-4">
            <h3>Create Allocation</h3>
            {error && <Alert variant="danger">{error}</Alert>}
            {workloadWarning && (
                <Alert variant="warning" className="workload-alert">
                    {workloadWarning}
                </Alert>
            )}
            {success && <Alert variant="success">{success}</Alert>}
            
            <style>
                {`
                    .workload-error {
                        padding: 10px 0;
                    }
                    .workload-error strong {
                        display: block;
                        margin-bottom: 8px;
                        color: #856404;
                    }
                    .workload-error div {
                        margin: 4px 0;
                    }
                    .workload-alert {
                        background-color: #fff3cd;
                        border-color: #ffeeba;
                    }
                `}
            </style>
            
            <Form onSubmit={handleSubmit}>
                <Row>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Teacher</Form.Label>
                            <Form.Select
                                name="teacher_id"
                                value={formData.teacher_id}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select Teacher</option>
                                {teachers.map(teacher => (
                                    <option key={teacher.teacher_id} value={teacher.teacher_id}>
                                        {teacher.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Course</Form.Label>
                            <Form.Select
                                name="course_id"
                                value={formData.course_id}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select Course</option>
                                {courses.map(course => (
                                    <option key={course.course_id} value={course.course_id}>
                                        {course.course_code} - {course.course_name}
                                    </option>
                                ))}
                            </Form.Select>
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
                            >
                                <option value="">Select Day</option>
                                {days.map(day => (
                                    <option key={day.day_id} value={day.day_id}>
                                        {day.day_name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
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
                                {timeSlots.map(slot => (
                                    <option key={slot.slot_id} value={slot.slot_id}>
                                        {slot.start_time.slice(0, -3)} - {slot.end_time.slice(0, -3)}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>

                <Form.Group className="mb-3">
                    <Form.Label>Room</Form.Label>
                    <Form.Select
                        name="room_id"
                        value={formData.room_id}
                        onChange={handleInputChange}
                        required
                        disabled={!formData.day_id || !formData.slot_id}
                    >
                        <option value="">Select Room</option>
                        {availableRooms.map(room => (
                            <option key={room.room_id} value={room.room_id}>
                                {room.room_number} (Capacity: {room.capacity}{room.is_lab ? ', Lab' : ''})
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>

                <div className="d-flex justify-content-between">
                    <Button 
                        variant="primary" 
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Allocation'}
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
