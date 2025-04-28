import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Button, Alert, Card, Form, Spinner, Badge } from 'react-bootstrap';

// Logging helper for frontend
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [AllocationList] ${message}`, data !== null ? data : '');
}

const AllocationList = ({ refresh }) => {
    const [allocations, setAllocations] = useState({});
    const [error, setError] = useState('');
    const [selectedDay, setSelectedDay] = useState('');
    const [loading, setLoading] = useState(false);

    const getAllocations = useCallback(async () => {
        log("INFO", "Fetching allocations trigger received.");
        setLoading(true); setError(''); setAllocations({});
        try {
            const response = await axios.get('http://localhost:5000/api/allocations');
            log("DEBUG", "API response received:", response.data);

            if (!Array.isArray(response.data)) {
                log("ERROR", "API response is not an array!", response.data);
                throw new Error("Invalid data format received from server.");
            }

            // Group allocations by day
            const grouped = response.data.reduce((acc, curr) => {
                const day = curr.day_name || 'Unknown Day';
                if (!acc[day]) acc[day] = [];
                acc[day].push(curr);
                return acc;
            }, {});

            // Sort allocations within each day by time
            Object.keys(grouped).forEach(day => {
                grouped[day].sort((a, b) => {
                    const timeA = a.start_time ? new Date(`1970/01/01 ${a.start_time}`) : 0;
                    const timeB = b.start_time ? new Date(`1970/01/01 ${b.start_time}`) : 0;
                    return timeA - timeB;
                });
            });
            log("INFO", `Grouped and sorted ${response.data.length} allocations.`);
            setAllocations(grouped);
        } catch (err) {
            log("ERROR", "Error fetching allocations:", err);
            setError(err.message || 'Error fetching allocations. Please try again later.');
            setAllocations({});
        } finally {
            log("DEBUG", "Finished fetching allocations.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        getAllocations();
    }, [refresh, getAllocations]);


    const handleDelete = async (id) => {
        log("INFO", `Attempting to delete allocation ID: ${id}`);
        const confirmDelete = window.confirm("Are you sure you want to delete this allocation?");
        if (!confirmDelete) {
            log("INFO", "Delete cancelled by user.");
            return;
        }

        try {
            await axios.delete(`http://localhost:5000/api/allocations/${id}`);
            log("INFO", `Successfully deleted allocation ID: ${id}`);
            getAllocations(); // Refetch the list after successful deletion
        } catch (err) {
            log("ERROR", `Error deleting allocation ID: ${id}`, err.response || err);
            setError('Error deleting allocation. Please try again.');
        }
    };


    const formatTime = (time) => {
         if (!time) return 'N/A';
         try {
             // Ensure time string is in HH:MM:SS format for Date parsing if needed
             const paddedTime = time.split(':').length === 2 ? `${time}:00` : time;
             return new Date(`1970/01/01 ${paddedTime}`).toLocaleTimeString([], {
                 hour: '2-digit', minute: '2-digit', hour12: true // Optional: use AM/PM
             });
         } catch { return 'Invalid Time'; }
    };

    const handleDayChange = (event) => {
        setSelectedDay(event.target.value);
    };

    // Filter days (safe because allocations is always an object)
    const availableDays = Object.keys(allocations).filter(day => allocations[day]?.length > 0);

    return (
        <div className="mt-4">
            <h3>Current Allocations</h3>
            {error && <Alert variant="danger">{error}</Alert>}

            {/* Day Selection Dropdown */}
            <Form.Group controlId="daySelect" className="mb-2">
                <Form.Select
                    value={selectedDay}
                    onChange={handleDayChange}
                    disabled={loading}
                    className="custom-select"
                    style={{
                        backgroundColor: 'cornflowerblue ', color: 'white', padding: '5px', textAlign: 'center',
                        appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 4 5\'%3E%3Cpath fill=\'white\' d=\'M2 0L0 2h4z\'/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.65em auto'
                     }}
                >
                    <option value="">Select Day</option>
                    {availableDays.map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </Form.Select>
            </Form.Group>

             {/* Loading Indicator */}
            {loading && (
                <div className="text-center my-3">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading Allocations...</span>
                    </Spinner>
                </div>
            )}

            {/* Allocation Table Display Logic */}
            {!loading && selectedDay && Array.isArray(allocations[selectedDay]) && allocations[selectedDay].length > 0 ? (
                <Card className="mb-3">
                    <Card.Body style={{ padding: '10px' }}>
                        <Table responsive striped bordered hover size="sm">
                             <thead>
                                <tr>
                                    <th style={{width: '20%'}}>Time</th>
                                    <th style={{width: '30%'}}>Course</th>
                                    <th style={{width: '25%'}}>Teacher</th>
                                    <th style={{width: '10%'}}>Room</th>
                                    <th style={{width: '15%'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocations[selectedDay].map(allocation => (
                                    <tr key={allocation.allocation_id}>
                                        <td>
                                            {formatTime(allocation.start_time)} - {formatTime(allocation.end_time)}
                                            <br />
                                        </td>
                                        <td>
                                            {allocation.course_name}
                                             <br/>
                                             <Badge pill bg={allocation.course_type === 'Lab' ? 'info' : 'secondary'}>
                                                 {allocation.course_type || 'N/A'}
                                             </Badge>
                                        </td>
                                        <td>{allocation.teacher_name || 'N/A'}</td>
                                        <td>
                                            {allocation.room_number || 'N/A'}
                                             <br/>
                                              
                                        </td>
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
            ) : !loading && selectedDay ? (
                 <Alert variant="info">No allocations found for {selectedDay}</Alert>
             ) : !loading ? (
                 <Alert variant="info">Please select a day to view allocations</Alert>
             ) : null }
        </div>
    );
};

export default AllocationList;