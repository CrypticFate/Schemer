import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Container, Alert, Spinner } from 'react-bootstrap';

const RoutineView = () => {
    const [routine, setRoutine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Time slots for the table
    const timeSlots = [
        '08:00 - 09:15',
        '09:15 - 10:30',
        '10:30 - 11:45',
        '11:45 - 13:00'
    ];

    // Days for the table
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    useEffect(() => {
        fetchRoutine();
    }, []);

    const fetchRoutine = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:5000/api/routine');
            setRoutine(response.data);
            setError('');
        } catch (err) {
            setError('Error fetching routine data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getCellContent = (day, timeSlot) => {
        if (!routine || !routine[day] || !routine[day][timeSlot]) {
            return <div className="empty-slot">No Class</div>;
        }

        const slot = routine[day][timeSlot];
        return (
            <div className="class-slot">
                <div className="course-code">{slot.course_code}</div>
                <div className="room-number">Room: {slot.room_number}</div>
                {/* <div className="teacher-name">{slot.teacher_name}</div> */}
            </div>
        );
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <h2 className="mb-4">Class Routine</h2>
            <div className="table-responsive">
                <Table bordered hover className="routine-table">
                    <thead className="table-dark">
                        <tr>
                            <th>Time / Day</th>
                            {days.map(day => (
                                <th key={day}>{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(timeSlot => (
                            <tr key={timeSlot}>
                                <td className="time-slot">{timeSlot}</td>
                                {days.map(day => (
                                    <td key={`${day}-${timeSlot}`} className="routine-cell">
                                        {getCellContent(day, timeSlot)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>

            <style>
                {`
                    .routine-table {
                        background-color: white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    
                    .time-slot {
                        font-weight: bold;
                        background-color: #f8f9fa;
                    }
                    
                    .routine-cell {
                        min-width: 200px;
                        padding: 10px !important;
                    }
                    
                    .empty-slot {
                        color: #6c757d;
                        font-style: italic;
                        text-align: center;
                        padding: 10px;
                    }
                    
                    .class-slot {
                        padding: 8px;
                        border-radius: 4px;
                        background-color: #f8f9fa;
                    }
                    
                    .course-code {
                        font-weight: bold;
                        color: #0d6efd;
                        margin-bottom: 4px;
                    }
                    
                    .room-number {
                        font-size: 0.9em;
                        color: #198754;
                        margin-bottom: 2px;
                    }
                    
                    .teacher-name {
                        font-size: 0.9em;
                        color: #6c757d;
                    }
                    
                    .table-responsive {
                        border-radius: 8px;
                        overflow: hidden;
                    }
                `}
            </style>
        </Container>
    );
};

export default RoutineView;