import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Alert, Card } from 'react-bootstrap';

const AllocationList = ({ refresh }) => {
    const [allocations, setAllocations] = useState({});
    const [error, setError] = useState('');

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

    if (Object.keys(allocations).length === 0) {
        return (
            <div className="mt-4">
                <h3>Current Allocations</h3>
                {error && <Alert variant="danger">{error}</Alert>}
                <Alert variant="info">No allocations found</Alert>
            </div>
        );
    }

    return (
        <div className="mt-4">
            <h3>Current Allocations</h3>
            {error && <Alert variant="danger">{error}</Alert>}

            {Object.entries(allocations).map(([day, dayAllocations]) => (
                <Card key={day} className="mb-4">
                    <Card.Header className="bg-primary text-white">
                        <h5 className="mb-0">{day}</h5>
                    </Card.Header>
                    <Card.Body>
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
                                {dayAllocations.map(allocation => (
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
            ))}
        </div>
    );
};

export default AllocationList;
