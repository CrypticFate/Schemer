import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Container, Alert, Spinner, Form, Row, Col, Button } from 'react-bootstrap';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const RoutineView = () => {
    const [routine, setRoutine] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    // Program and sections
    const programs = {
        "CSE": 2, "SWE": 1, "EEE": 3, "ME": 2, "IPE": 1, "CEE": 3, "BTM": 1
    };

    const routineImage = () => {
        const element = document.getElementById("routine-table");

        html2canvas(element, {scale: 4}).then((canvas) => {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            console.log("Selected Section:", selectedSection);
            link.download = `${selectedProgram} - routine(Sec - ${selectedSection}).png`;
            link.click();
        });
    };

    const routinePDF = async () => {
        const element = document.getElementById("routine-table");

        html2canvas(element, {scale: 4}).then((canvas) => {
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("l", "mm", "a4");
            const pdfWidth = 297; 
            const pdfHeight = 210; 
            
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const yPos = (pdfHeight - imgHeight) / 2;

            pdf.addImage(imgData, "PNG", 0, yPos, imgWidth, imgHeight);
            pdf.save(`${selectedProgram} - routine(Sec - ${selectedSection}).pdf`);

        })
    }

    const sections = selectedProgram ? Array.from({ length: programs[selectedProgram] }, (_, i) => i + 1) : [];

    const timeSlots = ['08:00 - 09:15', '09:15 - 10:30', '10:30 - 11:45', '11:45 - 13:00'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const fetchRoutine = useCallback(async () => {
        if (selectedProgram && selectedSection) {
            try {
                setLoading(true);
                const response = await axios.get(`http://localhost:5000/api/routine/`, {
                    params: {
                        program: selectedProgram,
                        section: selectedSection
                    }
                });
                setRoutine(response.data);
                setError('');
            } catch (err) {
                setError('Error fetching routine data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    }, [selectedProgram, selectedSection]);

    useEffect(() => {
        fetchRoutine();
    }, [fetchRoutine]);

    const getCellContent = (day, timeSlot) => {
        if (!routine || !routine[day] || !routine[day][timeSlot]) {
            return <div className="empty-slot">No Class</div>;
        }
        const slot = routine[day][timeSlot];
        return (
            <div className="class-slot">
                <div className="course-code">{slot.course_code}</div>
                <div className="room-number">Room: {slot.room_number}</div>
            </div>
        );
    };

    return (
        <Container className="mt-4">
            <h2 className="mb-4">Class Routine</h2>
            <Row className="mb-4">
                <Col md={6}>
                <Form.Group controlId="programSelect" className="mb-3">
                            <Form.Label>Program</Form.Label>
                            <Form.Select value={selectedProgram} onChange={(e) => {
                                setSelectedProgram(e.target.value);
                                setSelectedSection(''); 
                                setRoutine(null);
                            }}>
                            <option value="">-- Select Program --</option>
                            {Object.keys(programs).map(program => (
                                <option key={program} value={program}>{program}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col md={6}>
                        <Form.Group controlId="sectionSelect">
                            <Form.Label>Section</Form.Label>
                            <Form.Select value={selectedSection} onChange={(e) => 
                                setSelectedSection(e.target.value)}
                                disabled={!selectedProgram}>
                                <option value="">{selectedProgram ? '-- Select Section --' : 'No Program Selected'}</option>

                                {sections.map(section => (
                                    <option key={section} value={section}>Section - {section}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                </Col>
            </Row>
            {loading && (
                <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Container>
            )}
            {error && (
                <Container className="mt-4">
                    <Alert variant="danger">{error}</Alert>
                </Container>
            )}
            {routine && (
                <>
                <div className="table-responsive" id = "routine-table">
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

                <div>
                <Button variant = "primary" className = "me-3" onClick = {routineImage}>
                    Download Image
                </Button>
                <Button variant = "success" onClick = {routinePDF}>
                    Download PDF
                </Button>
                </div>
                </>
            )}

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