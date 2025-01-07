import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Alert, Card, Form } from 'react-bootstrap';

const AllocationList = ({ refresh }) => {
    const [allocations, setAllocations] = useState({});
    const [error, setError] = useState('');
    const [selectedDay, setSelectedDay] = useState(''); // State for the selected day

    useEffect(() => {
        getAllocations();
    }, [refresh]);

    const getAllocations = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/allocations');

            // Group allocations by day
            const grouped = response.data.reduce((acc, curr) => {
                if (!acc[curr.day_name]) {
                    acc[curr.day_name] = [];
                }
                acc[curr.day_name].push(curr);
                return acc;
            }, {});

            // Sort allocations within each day by time
            Object.keys(grouped).forEach(day => {
                grouped[day].sort((a, b) => {
                    return new Date('1970/01/01 ' + a.start_time) - new Date('1970/01/01 ' + b.start_time);
                });
            });

            setAllocations(grouped);
        } catch (err) {
            setError('Error fetching allocations');
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`http://localhost:5000/api/allocations/${id}`);
            getAllocations();
        } catch (err) {
            setError('Error deleting allocation');
            console.error(err);
        }
    };

    const formatTime = (time) => {
        return new Date('1970/01/01 ' + time).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    };

    const handleDayChange = (event) => {
        setSelectedDay(event.target.value);
    };

    // Filter days to only include those with allocations
    const availableDays = Object.keys(allocations).filter(day => allocations[day].length > 0);

    return (
        <div className="mt-4">
            <h3>Current Allocations</h3>
            {error && <Alert variant="danger">{error}</Alert>}

            <Form.Group controlId="daySelect" className="mb-2">
                <Form.Select 
                    value={selectedDay} 
                    onChange={handleDayChange}
                    className="custom-select"
                    style={{ 
                        backgroundColor: 'cornflowerblue ', 
                        color: 'white', 
                        padding: '5px', 
                        textAlign: 'center', 
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 4 5\'%3E%3Cpath fill=\'white\' d=\'M2 0L0 2h4z\'/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '0.65em auto'
                    }} 
                >
                    <option value="">Select Day</option>
                    {availableDays.map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            {selectedDay && allocations[selectedDay]?.length > 0 ? (
                <Card className="mb-3">
                    {/* <Card.Header className="bg-primary text-white">
                        <h5 className="mb-0">{selectedDay}</h5>
                    </Card.Header> */}
                    <Card.Body style={{ padding: '10px' }}>
                        <Table responsive striped bordered hover>
                            <thead>
                                <tr>
                                    <th style={{width: '15%'}}>Time</th>
                                    <th style={{width: '25%'}}>Course</th>
                                    <th style={{width: '25%'}}>Teacher</th>
                                    <th style={{width: '15%'}}>Room</th>
                                    <th style={{width: '20%'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocations[selectedDay].map(allocation => (
                                    <tr key={allocation.allocation_id}>
                                        <td>
                                            {formatTime(allocation.start_time)} - {formatTime(allocation.end_time)}
                                        </td>
                                        <td>{allocation.course_name}</td>
                                        <td>{allocation.teacher_name}</td>
                                        <td>{allocation.room_number}</td>
                                        <td>
                                            <Button 
                                                variant="danger" 
                                                size="sm"
                                                onClick={() => handleDelete(allocation.allocation_id)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card.Body>
                </Card>
            ) : selectedDay ? (
                <Alert variant="info">No allocations found for {selectedDay}</Alert>
            ) : (
                <Alert variant="info">Please select a day to view allocations</Alert>
            )}
        </div>
    );
};

export default AllocationList;
