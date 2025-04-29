import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Container, Form, Table, Button, Spinner, Badge, Alert, Row, Col } from "react-bootstrap";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// --- Time Helper Functions ---
const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return new Date(1970, 0, 1, hours, minutes, 0);
};

const formatDisplayTime = (timeStr) => {
    const date = parseTime(timeStr);
    if (!date) return 'N/A';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};
// --- End Time Helpers ---


const TeacherRoutine = () => {
  // --- State Variables ---
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [fetchedAllocations, setFetchedAllocations] = useState([]); // Raw data from API
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Constants ---
  // Define the visual rows for the table grid, including split afternoon lab
  const displaySlots = [
    { start: '08:00', end: '09:15' },
    { start: '09:15', end: '10:30' },
    { start: '10:30', end: '11:45' },
    { start: '11:45', end: '13:00' },
    { start: '14:30', end: '15:45' }, // Afternoon Part 1
    { start: '15:45', end: '17:00' }, // Afternoon Part 2
  ].sort((a, b) => parseTime(a.start) - parseTime(b.start)); // Ensure sorted

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // --- Data Fetching ---
  // Fetch list of teachers with allocations
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setError('');
        const response = await axios.get("http://localhost:5000/api/teachers-with-allocations");
        if (Array.isArray(response.data)) {
          setTeachers(response.data);
        } else {
           console.error("Invalid data received for teachers:", response.data);
           setError("Could not load teacher list.");
           setTeachers([]);
        }
      } catch (err) {
        setError("Error fetching teacher list.");
        console.error("Error fetching teachers:", err);
        setTeachers([]);
      }
    };
    fetchTeachers();
  }, []);

  // Fetch specific teacher's routine
  const fetchTeacherRoutine = useCallback(async () => {
    if (!selectedTeacher) {
        setFetchedAllocations([]); setError(''); return;
    }
    setLoading(true); setError(''); setFetchedAllocations([]);
    console.log(`Fetching routine for teacher ID: ${selectedTeacher}`);
    try {
        const response = await axios.get(`http://localhost:5000/api/teachers/${selectedTeacher}/routine`);
        console.log("Teacher routine data received:", response.data);
        if (Array.isArray(response.data)) {
            setFetchedAllocations(response.data); // Store the raw array
        } else {
             console.error("Invalid data received for teacher routine:", response.data);
             setError("Received invalid routine data format.");
             setFetchedAllocations([]);
        }
    } catch (err) {
        setError("Error fetching teacher routine.");
        console.error("Error fetching routine:", err.response?.data || err.message);
        setFetchedAllocations([]);
    } finally { setLoading(false); }
  }, [selectedTeacher]);

  // Trigger fetch when teacher changes
  useEffect(() => { fetchTeacherRoutine(); }, [fetchTeacherRoutine]);

  // --- Event Handlers ---
  const handleTeacherChange = (e) => {
    const teacherId = e.target.value;
    setSelectedTeacher(teacherId);
    const teacher = teachers.find((t) => t.teacher_id.toString() === teacherId);
    setTeacherEmail(teacher ? teacher.email : "");
    setSelectedTeacherName(teacher ? teacher.name : "");
    setFetchedAllocations([]); setError(''); // Clear data for new fetch
  };

  // --- Download Handlers ---
  const downloadAsImage = () => {
    const element = document.getElementById("teacher-routine-container");
    if (!element || !selectedTeacherName) { console.error("Cannot download image: Element or teacher name missing."); return; }
    html2canvas(element, { scale: 2 }).then((canvas) => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${selectedTeacherName.replace(/\s+/g, '_')}_Routine.png`;
        link.click();
    }).catch(err => console.error("Error generating image:", err));
  };

  const downloadAsPDF = () => {
    const element = document.getElementById("teacher-routine-container");
    if (!element || !selectedTeacherName) { console.error("Cannot download PDF: Element or teacher name missing."); return; }
    const title = `${selectedTeacherName}'s Routine`;
    html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight();
        const ratio = canvas.width / canvas.height;
        let imgWidth = pdfWidth - 20; let imgHeight = imgWidth / ratio;
        if (imgHeight > pdfHeight - 20) { imgHeight = pdfHeight - 20; imgWidth = imgHeight * ratio; }
        const xPos = (pdfWidth - imgWidth) / 2; const yPos = 15;
        pdf.setFontSize(16); pdf.text(title, pdfWidth / 2, 10, { align: 'center' });
        pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
        pdf.save(`${selectedTeacherName.replace(/\s+/g, '_')}_Routine.pdf`);
    }).catch(err => console.error("Error generating PDF:", err));
  };

   // --- Helper to Calculate Row Span ---
   const calculateRowSpan = (slotStartTime, slotEndTime) => {
    const start = parseTime(slotStartTime);
    const end = parseTime(slotEndTime);
    if (!start || !end || start >= end) return 1;
    let span = 0; let firstSlotFound = false;
    for (const displaySlot of displaySlots) {
        const displayStart = parseTime(displaySlot.start); const displayEnd = parseTime(displaySlot.end);
        if (displayStart < end && displayEnd > start) {
            if (displayStart >= start) firstSlotFound = true;
            if (firstSlotFound) span++;
        }
        if (displayStart >= end) break;
    }
    return Math.max(1, span);
   };

 // --- Render Table Body ---
 const renderTableBody = () => {
    const cellsToSkip = {};
    return (
        <tbody>
            {displaySlots.map((displaySlot, rowIndex) => (
                <tr key={displaySlot.start}>
                    <td className="time-slot">{formatDisplayTime(displaySlot.start)} - {formatDisplayTime(displaySlot.end)}</td>
                    {days.map(day => {
                        if (cellsToSkip[day]?.[displaySlot.start]) return null;
                        let cellContent = <div className="empty-slot">No Class</div>;
                        let cellRowSpan = 1;
                        const matchingAllocation = Array.isArray(fetchedAllocations) ? fetchedAllocations.find(alloc =>
                            alloc.day_name === day && alloc.start_time &&
                            parseTime(alloc.start_time)?.getTime() === parseTime(displaySlot.start)?.getTime()
                        ) : null;

                        if (matchingAllocation) {
                            const startTimeStr = matchingAllocation.start_time; const endTimeStr = matchingAllocation.end_time;
                            cellRowSpan = calculateRowSpan(startTimeStr, endTimeStr);
                            if (cellRowSpan > 1) {
                                if (!cellsToSkip[day]) cellsToSkip[day] = {};
                                for (let i = 1; i < cellRowSpan; i++) {
                                    const nextRowIndex = rowIndex + i;
                                    if (nextRowIndex < displaySlots.length) cellsToSkip[day][displaySlots[nextRowIndex].start] = true;
                                }
                            }
                            const isLab = matchingAllocation.course_type === 'Lab' || cellRowSpan > 1;
                            cellContent = (
                                <div className={`class-slot ${isLab ? 'lab-slot' : 'theory-slot'}`}>
                                    <div className="course-name">{matchingAllocation.course_name || 'N/A'}</div>
                                    <div className="room-number">Room: {matchingAllocation.room_number || 'N/A'}</div>
                                     <Badge pill bg={isLab ? 'info' : 'secondary'} className="mt-1">
                                         {matchingAllocation.course_type || (isLab ? 'Lab' : 'Theory')}
                                     </Badge>
                                </div> );
                        }
                        return (<td key={`${day}-${displaySlot.start}`} className="routine-cell" rowSpan={cellRowSpan}>{cellContent}</td>);
                    })}
                </tr>
            ))}
        </tbody>
    );
 };


  // --- Component Return / Render ---
  return (
    <Container fluid className="mt-4">
      <h2 className="mb-4 text-center">Teacher's Routine</h2>

      {/* Selection Row */}
      <Row className="mb-4 justify-content-center">
        <Col md={5}>
          <Form.Group>
            <Form.Label>Select Teacher</Form.Label>
            <Form.Select value={selectedTeacher} onChange={handleTeacherChange}>
              <option value="">-- Choose a teacher --</option>
              {Array.isArray(teachers) && teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={5}>
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control type="text" value={teacherEmail} readOnly placeholder="Teacher's email" className="bg-light" />
          </Form.Group>
        </Col>
      </Row>

      {/* Loading / Error / Routine Display */}
      {loading && (<div className="text-center my-5"> <Spinner animation="border" /> </div>)}
      {!loading && error && (<Alert variant="danger" className="text-center">{error}</Alert>)}

      {!loading && !error && selectedTeacher && (
          <>
             <div className="routine-container mb-3" id="teacher-routine-container">
                 <h4 className="text-center mb-3">{selectedTeacherName}'s Routine</h4>
                 <div className="table-responsive" id="teacher-routine-table">
                    <Table bordered hover className="routine-table text-center">
                        <thead>
                            <tr>
                                <th style={{ width: '15%', backgroundColor: '#f8f9fa' }}>Time / Day</th>
                                {days.map((day) => (<th key={day} style={{ width: '17%', backgroundColor: '#f8f9fa' }}>{day}</th>))}
                            </tr>
                        </thead>
                        {renderTableBody()}
                    </Table>
                 </div>
             </div>
            <div className="text-center mt-3 mb-4">
              <Button variant="primary" className="me-3" onClick={downloadAsImage}> Download as Image </Button>
              <Button variant="success" onClick={downloadAsPDF}> Download as PDF </Button>
            </div>
          </>
        )
      }
       {!loading && !error && !selectedTeacher && (<Alert variant="info" className="text-center">Please select a teacher to view their routine.</Alert>)}

      {/* Embedded Styles */}
      <style jsx>{`
        .routine-container { border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; background-color: #fff; }
        .routine-table { box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 0; vertical-align: middle; }
        .routine-table th { background-color: #e9ecef; color: #212529; text-align: center; border-bottom-width: 2px; }
        .routine-table td { height: 65px; }
        .time-slot { font-weight: bold; background-color: #f8f9fa; vertical-align: middle; text-align: center; }
        .routine-cell { min-width: 140px; padding: 4px !important; position: relative; }
        .empty-slot { color: #adb5bd; font-style: italic; text-align: center; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 0.85em; }
        .class-slot { padding: 5px; border-radius: 4px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 0.80em; text-align: center; }
        .theory-slot { background-color: #f8f9fa; border-left: 3px solid #6c757d; } /* Adjusted theory bg */
        .lab-slot { background-color: #cfe2ff; border-left: 3px solid #0d6efd; }
        .course-name { font-weight: bold; color: #000; margin-bottom: 2px; }
        .room-number { font-size: 0.95em; color: #495057; margin-bottom: 2px; }
        .table-responsive { overflow: hidden; }
        .bg-light[readOnly] { background-color: #e9ecef !important; opacity: 1; }
      `}</style>
    </Container>
  );
};

export default TeacherRoutine;