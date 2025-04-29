// --- START OF FILE AllocationList.js ---
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Button, Alert, Card, Form, Spinner, Badge } from 'react-bootstrap';

// Logging helper (optional)
const log = (level, message, data = null) => { /* ... */ };

const AllocationList = ({ refresh }) => {
    const [allocations, setAllocations] = useState({});
    const [error, setError] = useState('');
    const [selectedDay, setSelectedDay] = useState('');
    const [loading, setLoading] = useState(false);

    const getAllocations = useCallback(async () => {
        log("INFO", "Fetching allocations...");
        setLoading(true); setError(''); setAllocations({});
        try {
            const response = await axios.get('http://localhost:5000/api/allocations');
            log("DEBUG", "API response received:", response.data);
            if (!Array.isArray(response.data)) { throw new Error("Invalid data format received."); }

            const grouped = response.data.reduce((acc, curr) => {
                const day = curr.day_name || 'Unknown Day';
                if (!acc[day]) acc[day] = []; acc[day].push(curr); return acc;
            }, {});
            Object.keys(grouped).forEach(day => {
                grouped[day].sort((a, b) => {
                    const timeA = a.start_time ? new Date(`1970/01/01 ${a.start_time}`) : 0;
                    const timeB = b.start_time ? new Date(`1970/01/01 ${b.start_time}`) : 0;
                    return timeA - timeB; });
            });
            log("INFO", `Grouped ${response.data.length} allocations.`);
            setAllocations(grouped);
        } catch (err) {
            log("ERROR", "Error fetching allocations:", err); setError(err.message || 'Error fetching allocations.'); setAllocations({});
        } finally { log("DEBUG", "Finished fetching allocations."); setLoading(false); }
    }, []);

    useEffect(() => { getAllocations(); }, [refresh, getAllocations]);

    const handleDelete = async (id) => { /* ... (keep existing delete logic + getAllocations call) ... */ };

    const formatTime = (time) => {
         if (!time) return 'N/A';
         try {
             const paddedTime = time.split(':').length === 2 ? `${time}:00` : time;
             return new Date(`1970/01/01 ${paddedTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
         } catch { return 'Invalid Time'; }
    };

    const handleDayChange = (event) => { setSelectedDay(event.target.value); };

    const availableDays = Object.keys(allocations).filter(day => allocations[day]?.length > 0);

    return (
        // Removed margin top
        <div>
            <Card className="shadow-sm"> {/* Added subtle shadow */}
                <Card.Header as="h3" className="text-center bg-dark text-white py-3"> {/* Darker Header */}
                    Current Allocations
                </Card.Header>
                <Card.Body className="p-4"> {/* Increased padding */}
                    {error && <Alert variant="danger">{error}</Alert>}

                    <Form.Group controlId="daySelect" className="mb-3">
                        <Form.Label className="fw-bold mb-1">View Allocations for Day</Form.Label>
                        {/* Using standard Bootstrap Select */}
                        <Form.Select
                            value={selectedDay}
                            onChange={handleDayChange}
                            disabled={loading}
                            aria-label="Select day to view allocations"
                        >
                            <option value="">-- Select a Day --</option>
                            {/* Render available days */}
                            {availableDays.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {loading && ( <div className="text-center my-3"><Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner></div> )}

                    {/* Allocation Table Display Logic */}
                    {!loading && selectedDay && Array.isArray(allocations[selectedDay]) && allocations[selectedDay].length > 0 ? (
                        <div className="table-responsive mt-3">
                            <Table striped bordered hover size="sm" className="align-middle text-center allocations-table"> {/* Added class */}
                                <thead className="table-secondary"> {/* Use secondary for header */}
                                    <tr>
                                        <th className="w-20">Time</th>
                                        <th className="w-25">Course</th>
                                        <th className="w-25">Teacher</th>
                                        <th className="w-15">Room</th>
                                        <th className="w-15">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations[selectedDay].map(alloc => (
                                        <tr key={alloc.allocation_id}>
                                            <td>
                                                <span className="d-block time-display">{formatTime(alloc.start_time)} -</span>
                                                <span className="d-block time-display">{formatTime(alloc.end_time)}</span>
                                                
                                            </td>
                                            <td>
                                                <span className="d-block course-name-display">{alloc.course_name}</span>
                                                 <Badge pill bg={alloc.course_type === 'Lab' ? 'primary' : 'success'} className="fw-normal type-badge">
                                                     {alloc.course_type || 'N/A'}
                                                 </Badge>
                                            </td>
                                            <td className="teacher-name-display">{alloc.teacher_name || 'N/A'}</td>
                                            <td>
                                                <span className="d-block room-number-display">{alloc.room_number || 'N/A'}</span>
                                                 
                                            </td>
                                            <td>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(alloc.allocation_id)}> {/* Outline Button */}
                                                    <i className="bi bi-trash"></i> Delete {/* Optional: Icon */}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : !loading && selectedDay ? (
                        <Alert variant="secondary" className="text-center mt-3">No allocations found for {selectedDay}</Alert>
                    ) : !loading ? (
                        <Alert variant="secondary" className="text-center mt-3">Please select a day to view allocations</Alert>
                    ) : null }
                </Card.Body>
            </Card>

             {/* Add custom styles for table content */}
             <style jsx global>{`
                .allocations-table td {
                    vertical-align: middle !important;
                    font-size: 0.88rem; /* Slightly smaller table text */
                }
                .allocations-table th {
                    font-weight: 600;
                     font-size: 0.9rem;
                }
                 .time-display {
                     font-weight: 500;
                     white-space: nowrap;
                 }
                 .course-name-display {
                     font-weight: 500;
                 }
                 .teacher-name-display {
                    color: #555;
                 }
                 .room-number-display{
                     font-weight: 500;
                 }
                .type-badge {
                    font-size: 0.7rem; /* Smaller badges */
                    padding: 0.2em 0.5em;
                }
                /* Add Bootstrap Icons CSS if using icons */
                /* @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css"); */
             `}</style>
        </div>
    );
};

export default AllocationList;
// --- END OF FILE AllocationList.js ---