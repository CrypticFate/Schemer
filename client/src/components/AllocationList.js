// --- START OF FILE AllocationList.js ---
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Button, Alert, Card, Form, Spinner, Badge } from 'react-bootstrap';

// Logging helper for frontend (optional, but useful for debugging)
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    // Basic check to avoid overly large objects in console if not needed
    const logData = data !== null ? (typeof data === 'object' && !(data instanceof Error) ? JSON.stringify(data, null, 2).substring(0, 500) + '...' : data) : '';
    console.log(`[${timestamp}] [${level}] [AllocationList] ${message}`, logData);
}

const AllocationList = ({ refresh }) => {
    const [allocations, setAllocations] = useState({});
    const [error, setError] = useState(''); // For general fetching errors
    const [deleteError, setDeleteError] = useState(''); // For delete specific errors
    const [selectedDay, setSelectedDay] = useState('');
    const [loading, setLoading] = useState(false); // For fetching allocations

    // Function to fetch allocations, wrapped in useCallback
    const getAllocations = useCallback(async () => {
        log("INFO", "Fetching allocations trigger received.");
        setLoading(true);
        setError(''); // Clear general fetch errors
        setDeleteError(''); // Clear delete errors on new fetch
        setAllocations({}); // Clear previous data
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
            setAllocations({}); // Reset on error
        } finally {
            log("DEBUG", "Finished fetching allocations.");
            setLoading(false); // Stop loading indicator
        }
    }, []); // Empty dependency array for useCallback is correct here

    // Effect to fetch data on initial load and when 'refresh' prop changes
    useEffect(() => {
        getAllocations();
    }, [refresh, getAllocations]); // Dependencies: refresh and the memoized getAllocations

    // Handler for deleting an allocation
    const handleDelete = async (id) => {
        log("INFO", `Attempting to delete allocation ID: ${id}`);
        setDeleteError(''); // Clear previous delete errors before attempting new one

        const confirmDelete = window.confirm("Are you sure you want to delete this allocation? This action cannot be undone.");
        if (!confirmDelete) {
            log("INFO", "Delete cancelled by user.");
            return;
        }

        try {
            // Send DELETE request
            const response = await axios.delete(`http://localhost:5000/api/allocations/${id}`);
            log("INFO", `Successfully deleted allocation ID: ${id}`, response.data);

            // Refresh the list by calling getAllocations again
            getAllocations();

        } catch (err) {
            log("ERROR", `Error deleting allocation ID: ${id}`, err.response || err);
            const message = err.response?.data?.error || 'Error deleting allocation. Please check console and try again.';
            // Display the specific error related to deletion
            setDeleteError(`Failed to delete allocation (ID: ${id}): ${message}`);
            setError(''); // Clear general fetch errors when a delete error occurs
        }
    };

    // Helper function to format time string
    const formatTime = (time) => {
         if (!time) return 'N/A';
         try {
             const paddedTime = time.split(':').length === 2 ? `${time}:00` : time;
             return new Date(`1970/01/01 ${paddedTime}`).toLocaleTimeString([], {
                 hour: '2-digit', minute: '2-digit', hour12: true
             });
         } catch { return 'Invalid Time'; }
    };

    // Handler for changing the selected day
    const handleDayChange = (event) => {
        setSelectedDay(event.target.value);
        setDeleteError(''); // Clear delete errors when changing day
        setError(''); // Clear fetch errors when changing day
    };

    // Get list of days that have allocations
    const availableDays = Object.keys(allocations).filter(day => allocations[day]?.length > 0);

    // --- Render Logic ---
    return (
        <div> {/* Removed margin top, parent Col should handle spacing */}
            <Card className="shadow-sm">
                <Card.Header as="h3" className="text-center bg-dark text-white py-3">Current Allocations</Card.Header>
                <Card.Body className="p-4">
                    {/* Display errors first */}
                    {error && <Alert variant="danger">{error}</Alert>}
                    {deleteError && <Alert variant="danger">{deleteError}</Alert>}

                    {/* Day Selection Dropdown */}
                    <Form.Group controlId="daySelect" className="mb-3">
                        <Form.Label className="fw-bold mb-1">View Allocations for Day</Form.Label>
                        <Form.Select
                            value={selectedDay}
                            onChange={handleDayChange}
                            disabled={loading} // Disable while loading list
                            aria-label="Select day to view allocations"
                        >
                            <option value="">-- Select a Day --</option>
                            {availableDays.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {/* Loading Indicator */}
                    {loading && (
                        <div className="text-center my-3">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </Spinner>
                        </div>
                    )}

                    {/* Allocation Table Display Logic */}
                    {!loading && selectedDay && Array.isArray(allocations[selectedDay]) && allocations[selectedDay].length > 0 ? (
                        <div className="table-responsive mt-3">
                            <Table striped bordered hover size="sm" className="align-middle allocations-table">
                                <thead className="table-light">
                                    <tr>
                                        {/* Adjusted Widths */}
                                        <th style={{width: '18%'}}>Time</th>
                                        <th style={{width: '25%'}}>Course</th>
                                        <th style={{width: '22%'}}>Teacher</th>
                                        <th style={{width: '10%'}}>Section</th> {/* Added Section Header */}
                                        <th style={{width: '10%'}}>Room</th>
                                        <th style={{width: '15%'}} className="text-center">Actions</th>
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
                                                 <Badge pill bg={alloc.course_type === 'Lab' ? 'primary' : 'success'} className="mt-1 type-badge">
                                                     {alloc.course_type || 'N/A'}
                                                 </Badge>
                                            </td>
                                            <td>
                                                <span className="d-block teacher-name-display">{alloc.teacher_name || 'N/A'}</span>
                                            </td>
                                            {/* Added Section Cell */}
                                            <td className="text-center">
                                                <span className="d-block section-display">{alloc.program} - {alloc.section || 'N/A'}</span>
                                            </td>
                                            <td>
                                                <span className="d-block room-number-display">{alloc.room_number || 'N/A'}</span>
                                                  
                                            </td>
                                            <td className="text-center">
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(alloc.allocation_id)}>
                                                    <i className="bi bi-trash"></i> Delete
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    // Show appropriate message if day selected but no allocations (and not loading)
                    ) : !loading && selectedDay ? (
                        <Alert variant="secondary" className="text-center mt-3">No allocations found for {selectedDay}.</Alert>
                    // Show message if no day selected (and not loading)
                    ) : !loading ? (
                        <Alert variant="secondary" className="text-center mt-3">Please select a day to view allocations.</Alert>
                    ) : null /* Render nothing else while loading */ }
                </Card.Body>
            </Card>

             {/* Styles (ensure consistency or move to CSS file) */}
             <style jsx global>{`
                .allocations-table td { vertical-align: middle !important; font-size: 0.88rem; }
                .allocations-table th { font-weight: 600; font-size: 0.9rem; text-align: center; vertical-align: middle;} /* Centered header text */
                .time-display { font-weight: 500; white-space: nowrap; }
                .course-name-display { font-weight: 500; }
                .teacher-name-display { color: #555; }
                .room-number-display{ font-weight: 500; }
                .section-display { font-weight: 500; color: #333; } /* Style for section */
                .type-badge { font-size: 0.7rem; padding: 0.2em 0.5em; }
                /* Example for Bootstrap Icons */
                /* @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css"); */
             `}</style>
        </div>
    );
};

export default AllocationList;
// --- END OF FILE AllocationList.js ---