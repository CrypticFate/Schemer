import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import Select from 'react-select'; // Import react-select
import { Container, Form, Table, Button, Spinner, Badge, Alert, Row, Col } from "react-bootstrap";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// --- Time Helper Functions ---
const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) {
        console.warn(`[parseTime] Invalid time format encountered: ${timeStr}`);
        return null;
    }
    // Use a consistent base date (UTC to avoid timezone issues if comparing getTime())
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
};

const formatDisplayTime = (timeStr) => {
    const date = parseTime(timeStr);
    if (!date) return 'N/A';
     // Format directly from UTC values if parseTime uses UTC
     const hours = date.getUTCHours();
     const minutes = date.getUTCMinutes();
     const ampm = hours >= 12 ? 'PM' : 'AM';
     const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
     const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
     return `${formattedHours}:${formattedMinutes} ${ampm}`;
    // Or use local time if acceptable:
    // return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};
// --- Logging Helper ---
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logData = data !== null ? (typeof data === 'object' && !(data instanceof Error) ? JSON.stringify(data).substring(0, 500) + '...' : data) : '';
    console.log(`[${timestamp}] [${level}] [TeacherRoutine] ${message}`, logData);
}
// --- End Helpers ---


const TeacherRoutine = () => {
  // --- State Variables ---
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(""); // Teacher ID (string)
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [fetchedAllocations, setFetchedAllocations] = useState([]);
  const [loading, setLoading] = useState(false); // Loading routine data
  const [loadingTeachers, setLoadingTeachers] = useState(true); // Loading teacher list
  const [error, setError] = useState('');

  // --- Constants ---
  const displaySlots = [
    { start: '08:00', end: '09:15' }, { start: '09:15', end: '10:30' },
    { start: '10:30', end: '11:45' }, { start: '11:45', end: '13:00' },
    { start: '14:30', end: '15:45' }, { start: '15:45', end: '17:00' },
  ].sort((a, b) => parseTime(a.start) - parseTime(b.start)); // Ensure sorted
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // --- Data Fetching ---
  useEffect(() => { // Fetch Teachers
    const fetchTeachers = async () => {
      setLoadingTeachers(true); setError('');
      try {
        const response = await axios.get("http://localhost:5000/api/teachers-with-allocations");
        if (Array.isArray(response.data)) { setTeachers(response.data); }
        else { log("ERROR", "Invalid data for teachers", response.data); setError("Could not load teacher list."); setTeachers([]); }
      } catch (err) { setError("Error fetching teacher list."); log("ERROR", "Fetch teachers error", err); setTeachers([]); }
      finally { setLoadingTeachers(false); }
    };
    fetchTeachers();
  }, []); // Run once

  const fetchTeacherRoutine = useCallback(async () => { // Fetch Routine
    if (!selectedTeacher) { setFetchedAllocations([]); setError(''); return; }
    setLoading(true); setError(''); setFetchedAllocations([]);
    log("INFO", `Fetching routine for teacher ID: ${selectedTeacher}`);
    try {
        const response = await axios.get(`http://localhost:5000/api/teachers/${selectedTeacher}/routine`);
        log("DEBUG", "Teacher routine data received:", response.data);
        if (Array.isArray(response.data)) { setFetchedAllocations(response.data); }
        else { log("ERROR", "Invalid data received", response.data); setError("Received invalid routine data format."); setFetchedAllocations([]); }
    } catch (err) { setError("Error fetching teacher routine."); log("ERROR", "Fetch routine API Error", err.response?.data || err.message); setFetchedAllocations([]); }
    finally { log("DEBUG", "Finished fetching routine. Setting loading=false."); setLoading(false); }
  }, [selectedTeacher]);

  useEffect(() => { fetchTeacherRoutine(); }, [fetchTeacherRoutine]);

  // --- Prepare options for react-select ---
  const teacherOptions = useMemo(() => {
      if (!Array.isArray(teachers)) return [];
      return teachers.map(teacher => ({ value: teacher.teacher_id, label: teacher.name }));
  }, [teachers]);
  const selectedTeacherOption = useMemo(() => {
      return teacherOptions.find(option => String(option.value) === selectedTeacher) || null;
  }, [selectedTeacher, teacherOptions]);

  // --- Prepare allocationMap (Moved outside renderTableBody) ---
  const allocationMap = useMemo(() => {
      const map = {};
      if (!Array.isArray(fetchedAllocations)) {
          // log("WARN", "allocationMap: fetchedAllocations is not array, returning empty map.");
          return map;
      }
      days.forEach(day => map[day] = {}); // Initialize days
      fetchedAllocations.forEach(alloc => {
          if (alloc.day_name && alloc.start_time) {
              const startTimeStr = alloc.start_time.slice(0, 5); // Key by HH:MM
              if (!map[alloc.day_name]) map[alloc.day_name] = {}; // Ensure day exists
              map[alloc.day_name][startTimeStr] = alloc; // Map by HH:MM start time
          } else {
              log("WARN", "allocationMap: Allocation missing day_name or start_time", alloc);
          }
      });
      // log("DEBUG", "allocationMap recalculated", map);
      return map;
  }, [fetchedAllocations]); // Recalculate only when fetchedAllocations changes


  // --- Event Handlers ---
  const handleTeacherChange = (selectedOption) => {
    const teacherId = selectedOption ? String(selectedOption.value) : "";
    log("INFO", `handleTeacherChange: Teacher selected - ID: ${teacherId}`);
    setSelectedTeacher(teacherId); // Update ID state FIRST

    const teacher = teacherId ? teachers.find((t) => String(t.teacher_id) === teacherId) : null;
    setTeacherEmail(teacher ? teacher.email : "");
    setSelectedTeacherName(teacher ? teacher.name : "");

    setFetchedAllocations([]); // Clear old data immediately
    setError('');
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
    if (!start || !end || start >= end) { log("WARN", "calculateRowSpan: Invalid start/end", { start: slotStartTime, end: slotEndTime }); return 1; }
    let span = 0; let firstSlotFound = false;
    for (const displaySlot of displaySlots) {
        const displayStart = parseTime(displaySlot.start); const displayEnd = parseTime(displaySlot.end);
        if (!displayStart || !displayEnd) continue;
        if (displayStart < end && displayEnd > start) {
            if (displayStart >= start) firstSlotFound = true;
            if (firstSlotFound) span++;
        }
        if (displayStart >= end) break;
    }
    const finalSpan = Math.max(1, span);
    return finalSpan;
   };

 // --- Render Table Body ---
 const renderTableBody = () => {
    // log("DEBUG", "renderTableBody executing. Allocation count:", fetchedAllocations?.length);
    const cellsToSkip = {}; // Track cells hidden by rowspan for this render pass

    return (
        <tbody>
            {displaySlots.map((displaySlot, rowIndex) => {
                const displaySlotStartStr = displaySlot.start;
                return (
                    <tr key={displaySlotStartStr}>
                        <td className="time-slot">{formatDisplayTime(displaySlot.start)} - {formatDisplayTime(displaySlot.end)}</td>
                        {days.map(day => {
                            const cellKey = `${day}-${displaySlotStartStr}`;
                            if (cellsToSkip[day]?.[displaySlotStartStr]) return null;

                            let cellContent = <div className="empty-slot">No Class</div>;
                            let cellRowSpan = 1;
                            // Use the pre-calculated map
                            const matchingAllocation = allocationMap[day]?.[displaySlotStartStr];

                            if (matchingAllocation) {
                                // log("DEBUG", `Match FOUND for ${cellKey}:`, matchingAllocation);
                                const startTimeStr = matchingAllocation.start_time; const endTimeStr = matchingAllocation.end_time;
                                cellRowSpan = calculateRowSpan(startTimeStr, endTimeStr);
                                // log("DEBUG", `RowSpan calculated for ${cellKey}: ${cellRowSpan}`);
                                if (cellRowSpan > 1) {
                                    if (!cellsToSkip[day]) cellsToSkip[day] = {};
                                    for (let i = 1; i < cellRowSpan; i++) {
                                        const nextRowIndex = rowIndex + i;
                                        if (nextRowIndex < displaySlots.length) {
                                            const nextDisplaySlotStart = displaySlots[nextRowIndex].start;
                                            // log("DEBUG", `Marking skip: ${day} @ ${nextDisplaySlotStart}`);
                                            cellsToSkip[day][nextDisplaySlotStart] = true;
                                        }
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
                            } else {
                                // log("DEBUG", `No match for ${cellKey}`);
                            }
                            return (<td key={cellKey} className="routine-cell" rowSpan={cellRowSpan}>{cellContent}</td>);
                        })}
                    </tr>
                );
            })}
        </tbody>
    );
 }; // End of renderTableBody


  // --- Component Return / Render ---
  return (
    <Container fluid className="mt-4">
      <h2 className="mb-4 text-center">Teacher's Routine</h2>

      {/* Selection Row */}
      <Row className="mb-4 justify-content-center">
        <Col md={5}>
           <Form.Group>
             <Form.Label>Select Teacher (Searchable)</Form.Label>
             <Select
                 options={teacherOptions}
                 value={selectedTeacherOption}
                 onChange={handleTeacherChange}
                 placeholder="Type or select teacher..."
                 isClearable
                 isLoading={loadingTeachers}
                 isDisabled={loadingTeachers}
                 styles={{ control: (base, state) => ({ ...base, minHeight: '38px', borderColor: state.isFocused ? '#86b7fe' : '#ced4da', boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none', '&:hover': { borderColor: state.isFocused ? '#86b7fe' : '#adb5bd' }, }), input: base => ({ ...base, margin: '0px' }), valueContainer: base => ({ ...base, padding: '0px 8px' }), }}
              />
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

      {/* Main Display Condition */}
      {!loading && !error && selectedTeacher && Array.isArray(fetchedAllocations) && (
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
                        {renderTableBody()} {/* Call the rendering function */}
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
      {/* Message if no teacher selected */}
       {!loading && !error && !selectedTeacher && !loadingTeachers && (<Alert variant="info" className="text-center">Please select a teacher to view their routine.</Alert>)}
      {/* Message if teacher selected but routine is empty */}
      {!loading && !error && selectedTeacher && fetchedAllocations?.length === 0 && (<Alert variant="warning" className="text-center">{selectedTeacherName} has no scheduled classes found.</Alert>)}


      {/* Embedded Styles */}
      <style jsx>{`
        .routine-container { border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; background-color: #fff; }
        .routine-table { box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 0; vertical-align: middle; }
        .routine-table th { background-color: #e9ecef; color: #212529; text-align: center; border-bottom-width: 2px; padding-top: 0.5rem; padding-bottom: 0.5rem;}
        .routine-table td { height: 65px; padding: 0.25rem !important;} /* Reduce padding further */
        .time-slot { font-weight: bold; background-color: #f8f9fa; vertical-align: middle; text-align: center; font-size: 0.9em; }
        .routine-cell { min-width: 130px; /* Adjusted width */ padding: 4px !important; position: relative; }
        .empty-slot { color: #adb5bd; font-style: italic; text-align: center; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 0.8em; }
        .class-slot { padding: 4px; border-radius: 4px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 0.75em; /* Further reduced font */ text-align: center; overflow: hidden; line-height: 1.3; }
        .theory-slot { background-color: #f8f9fa; border-left: 3px solid #6c757d; }
        .lab-slot { background-color: #cfe2ff; border-left: 3px solid #0d6efd; }
        .course-name { font-weight: bold; color: #000; margin-bottom: 1px; }
        .room-number { font-size: 0.9em; color: #495057; margin-bottom: 1px; }
        .teacher-name { font-size: 0.9em; color: #6c757d; } /* Added teacher name style */
        .table-responsive { overflow: hidden; }
        .bg-light[readOnly] { background-color: #e9ecef !important; opacity: 1; }
      `}</style>
    </Container>
  );
};

export default TeacherRoutine;