import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Table,
  Container,
  Alert,
  Spinner,
  Form,
  Row,
  Col,
  Button,
  Badge,
} from "react-bootstrap";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Helper to parse time string HH:MM
const parseTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const date = new Date(1970, 0, 1, hours, minutes, 0);
  return date;
};

// Helper to format time HH:MM AM/PM
const formatDisplayTime = (timeStr) => {
  const date = parseTime(timeStr);
  if (!date) return "N/A";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const RoutineView = () => {
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  // Note: skippedCells state is not strictly needed with the rowspan approach,
  // but can be kept if complex overlapping logic were ever added. Removing for simplicity now.
  // const [skippedCells, setSkippedCells] = useState({});

  const programs = { CSE: 2, SWE: 1, EEE: 3, ME: 2, IPE: 1, CEE: 3, BTM: 1 };
  const sections = selectedProgram
    ? Array.from({ length: programs[selectedProgram] || 0 }, (_, i) => i + 1)
    : [];
  const semesters = Array.from({ length: 8 }, (_, i) => i + 1);

  // *** UPDATED displaySlots Array ***
  // Define canonical display slots (rows in the table)
  // Split the afternoon lab slot into two visual rows
  const displaySlots = [
    { start: "08:00", end: "09:15" }, // Theory 1
    { start: "09:15", end: "10:30" }, // Theory 2
    { start: "10:30", end: "11:45" }, // Theory 3
    { start: "11:45", end: "13:00" }, // Theory 4
    // --- Afternoon Split ---
    { start: "14:30", end: "15:45" }, // Afternoon Lab - Part 1 (Visually)
    { start: "15:45", end: "17:00" }, // Afternoon Lab - Part 2 (Visually)
    // --- End Afternoon Split ---
  ].sort((a, b) => parseTime(a.start) - parseTime(b.start)); // Ensure sorted by time

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // --- Fetch Routine Data ---
  const fetchRoutine = useCallback(async () => {
    if (selectedProgram && selectedSection && selectedSemester) {
      setLoading(true);
      setError("");
      setRoutine(null);
      try {
        const response = await axios.get(`http://localhost:5000/api/routine/`, {
          params: {
            program: selectedProgram,
            section: selectedSection,
            semester: selectedSemester,
          },
        });
        console.log("Routine data received:", response.data);
        setRoutine(response.data);
      } catch (err) {
        setError("Error fetching routine data. Please try again.");
        console.error(
          "Fetch Routine Error:",
          err.response?.data || err.message
        );
        setRoutine({});
      } finally {
        setLoading(false);
      }
    } else {
      setRoutine(null);
    }
  }, [selectedProgram, selectedSection, selectedSemester]);

  useEffect(() => {
    fetchRoutine();
  }, [fetchRoutine]);

  // --- Download Handlers ---
  const routineImage = () => {
    const element = document.getElementById("routine-table-container"); // Target the container div
    if (!element) return;
    html2canvas(element, { scale: 2 }) // Adjust scale as needed
      .then((canvas) => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${selectedProgram}_Sec-${selectedSection}_Sem-${selectedSemester}_Routine.png`; // Cleaned filename
        link.click();
      })
      .catch((err) => console.error("Error generating image:", err));
  };

  const routinePDF = () => {
    // Simplified PDF generation
    const element = document.getElementById("routine-table-container"); // Target the container div
    if (!element) return;
    const title = `${selectedProgram} - Section ${selectedSection} Routine`;

    html2canvas(element, { scale: 2 }) // Adjust scale as needed
      .then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape", // 'l' or 'p'
          unit: "mm",
          format: "a4",
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;

        let imgWidth = pdfWidth - 20; // pdf width with margin
        let imgHeight = imgWidth / ratio;

        // If calculated height exceeds pdf height, scale based on height instead
        if (imgHeight > pdfHeight - 20) {
          imgHeight = pdfHeight - 20; // pdf height with margin
          imgWidth = imgHeight * ratio;
        }

        const xPos = (pdfWidth - imgWidth) / 2; // Center horizontally
        const yPos = 15; // Top margin for title

        pdf.setFontSize(16);
        pdf.text(title, pdfWidth / 2, 10, { align: "center" }); // Add title to PDF

        pdf.addImage(imgData, "PNG", xPos, yPos, imgWidth, imgHeight);
        pdf.save(
          `${selectedProgram}_Sec-${selectedSection}_Sem-${selectedSemester}_Routine.pdf`
        ); // Cleaned filename
      })
      .catch((err) => console.error("Error generating PDF:", err));
  };

  // --- Helper to Calculate Row Span ---
  // Calculates how many *display slots* the actual allocated slot spans
  const calculateRowSpan = (slotStartTime, slotEndTime) => {
    const start = parseTime(slotStartTime);
    const end = parseTime(slotEndTime);
    if (!start || !end || start >= end) return 1; // Basic validation

    let span = 0;
    let firstSlotFound = false;
    for (const displaySlot of displaySlots) {
      const displayStart = parseTime(displaySlot.start);
      const displayEnd = parseTime(displaySlot.end);

      // Check if the display slot overlaps with the actual slot duration
      if (displayStart < end && displayEnd > start) {
        // Check if this is the first overlapping display slot
        if (displayStart >= start) {
          firstSlotFound = true;
        }
        // If it's part of the span, increment count
        if (firstSlotFound) {
          span++;
        }
      }
      // Optimization: If current display slot starts after actual slot ends, break early
      if (displayStart >= end) {
        break;
      }
    }
    return Math.max(1, span); // Ensure span is at least 1
  };

  // --- Render Table Body ---
  const renderTableBody = () => {
    // Keeps track of which cells to skip in the current row rendering pass
    const cellsToSkip = {}; // Format: { Monday: { '15:45': true }, ... }

    return (
      <tbody>
        {displaySlots.map((displaySlot, rowIndex) => {
          // Check if this whole row should be skipped (unlikely with current logic, but good practice)
          // if (cellsToSkip['row']?.[displaySlot.start]) return null;

          return (
            <tr key={displaySlot.start}>
              {/* Time Column */}
              <td className="time-slot">
                {formatDisplayTime(displaySlot.start)} -{" "}
                {formatDisplayTime(displaySlot.end)}
              </td>

              {/* Day Columns */}
              {days.map((day) => {
                // --- Skip Check ---
                // If this specific cell [day][startTime] is marked for skipping, render nothing
                if (cellsToSkip[day]?.[displaySlot.start]) {
                  // Important: Remove the skip marker after using it so it doesn't affect future renders if data changes
                  // delete cellsToSkip[day][displaySlot.start]; // Might be complex to manage deletion correctly across renders
                  // It's simpler to recalculate skips on each render pass based on the actual data
                  return null;
                }

                let cellContent = <div className="empty-slot">No Class</div>;
                let cellRowSpan = 1;
                let foundMatch = false; // Flag to ensure we only process the first matching slot for a rowspan

                // --- Find Matching Slot ---
                // Check routine data for the current day
                const dayRoutine = routine?.[day]; // e.g., { "08:00 - 09:15": {...}, "14:30 - 17:00": {...} }

                if (dayRoutine) {
                  // Iterate through actual allocated slots for that day
                  for (const actualSlotKey in dayRoutine) {
                    const slotData = dayRoutine[actualSlotKey];
                    const [actualStartTimeStr, actualEndTimeStr] =
                      actualSlotKey.split(" - ");

                    // Check if the *start* of the current display row matches the *start* of an actual allocated slot
                    if (actualStartTimeStr === displaySlot.start) {
                      foundMatch = true; // We found the starting point

                      // Calculate the span based on the actual allocated slot duration
                      cellRowSpan = calculateRowSpan(
                        actualStartTimeStr,
                        actualEndTimeStr
                      );

                      // Mark subsequent display rows for skipping *within this day*
                      if (cellRowSpan > 1) {
                        if (!cellsToSkip[day]) cellsToSkip[day] = {}; // Initialize day object if needed
                        for (let i = 1; i < cellRowSpan; i++) {
                          const nextRowIndex = rowIndex + i;
                          if (nextRowIndex < displaySlots.length) {
                            const nextDisplaySlotStart =
                              displaySlots[nextRowIndex].start;
                            cellsToSkip[day][nextDisplaySlotStart] = true; // Mark for skipping
                          }
                        }
                      }

                      // Determine type (simple check based on span)
                      const isLab =
                        cellRowSpan > 1 || slotData.course_type === "Lab"; // Also check actual type if available

                      // Prepare cell content
                      cellContent = (
                        <div
                          className={`class-slot ${
                            isLab ? "lab-slot" : "theory-slot"
                          }`}
                        >
                          <div className="course-code">
                            {slotData.course_code || "N/A"}
                          </div>
                          <div className="room-number">
                            Room: {slotData.room_number || "N/A"}
                          </div>
                          {slotData.teacher_name && (
                            <div className="teacher-name">
                              ({slotData.teacher_name})
                            </div>
                          )}
                          <Badge
                            pill
                            bg={isLab ? "primary" : "success"}
                            className="mt-1 type-badge"
                          >
                            {isLab ? "Lab" : "Theory"}
                          </Badge>
                        </div>
                      );
                      break; // Found the matching slot for this display row start time, no need to check others
                    }
                  }
                }

                // --- Render Cell ---
                // Render the TD with calculated rowspan and content
                return (
                  <td
                    key={`${day}-${displaySlot.start}`}
                    className="routine-cell"
                    rowSpan={cellRowSpan}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    );
  };

  return (
    <Container fluid className="mt-4">
      <h2 className="mb-4 text-center">Class Routine</h2>

      {/* Selection Row */}
      <Row className="mb-4 justify-content-center">
        <Col md={4}>
          <Form.Group controlId="programSelect" className="mb-3">
            <Form.Label>Program</Form.Label>
            <Form.Select
              value={selectedProgram}
              onChange={(e) => {
                setSelectedProgram(e.target.value);
                setSelectedSection("");
                setRoutine(null);
              }}
            >
              <option value="">-- Select Program --</option>
              {Object.keys(programs).map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group controlId="semesterSelect">
            <Form.Label>Semester</Form.Label>
            <Form.Select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              disabled={!selectedProgram}
            >
              <option value="">
                {selectedProgram
                  ? "-- Select Semester --"
                  : "Select Program First"}
              </option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  Semester - {sem}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group controlId="sectionSelect">
            <Form.Label>Section</Form.Label>
            <Form.Select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedProgram || !selectedSemester}
            >
              <option value="">
                {!selectedProgram
                  ? "Select Program First"
                  : !selectedSemester
                  ? "Select Semester First"
                  : "-- Select Section --"}
              </option>
              {sections.map((section) => (
                <option key={section} value={section}>
                  Section - {section}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {/* Loading / Error Display */}
      {loading && (
        <Container
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "200px" }}
        >
          <Spinner animation="border" />
        </Container>
      )}
      {!loading && error && (
        <Container className="mt-4">
          <Alert variant="danger">{error}</Alert>
        </Container>
      )}

      {/* Routine Table and Buttons */}
      {!loading && !error && routine && selectedProgram && selectedSection && (
        <>
          {/* Added container div with ID for downloads */}
          <div className="routine-container mb-3" id="routine-table-container">
            <h4 className="text-center mb-3">
              {selectedProgram} - Section {selectedSection} - Semester{" "}
              {selectedSemester} Routine
            </h4>
            <div className="table-responsive" id="routine-table">
              {" "}
              {/* Keep ID on table if needed by specific styling */}
              <Table bordered hover className="routine-table text-center">
                <thead /* className="table-dark" - Removed dark header for better PDF/Image capture */
                >
                  <tr>
                    <th style={{ width: "15%", backgroundColor: "#f8f9fa" }}>
                      Time / Day
                    </th>
                    {days.map((day) => (
                      <th
                        key={day}
                        style={{ width: "17%", backgroundColor: "#f8f9fa" }}
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                {renderTableBody()}
              </Table>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="text-center mb-4">
            <Button variant="primary" className="me-3" onClick={routineImage}>
              {" "}
              Download Image{" "}
            </Button>
            <Button variant="success" onClick={routinePDF}>
              {" "}
              Download PDF{" "}
            </Button>
          </div>
        </>
      )}
      {!loading && !error && (!selectedProgram || !selectedSection) && (
        <Alert variant="info">
          Please select the Program, Semester and Section to view the routine.
        </Alert>
      )}

      <style>
        {`
                    /* Styles remain largely the same, ensure they look good with rowspan */
                     .routine-container { border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; background-color: #fff; }
                     .routine-table { box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 0; vertical-align: middle; }
                     .routine-table th { /* background-color: #343a40; color: white; */ background-color: #e9ecef; color: #212529; text-align: center; border-bottom-width: 2px; }
                     .routine-table td { height: 65px; /* Adjusted height slightly */ }
                     .time-slot { font-weight: bold; background-color: #f8f9fa; vertical-align: middle; text-align: center; }
                     .routine-cell { min-width: 140px; padding: 4px !important; position: relative; }
                     .empty-slot { color: #adb5bd; font-style: italic; text-align: center; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 0.85em; }
                     .class-slot { padding: 5px; border-radius: 4px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 0.80em; /* Even smaller */ text-align: center; }
                     .theory-slot { background-color: #e9ecef; border-left: 3px solid #6c757d; }
                     .lab-slot { background-color: #cfe2ff; border-left: 3px solid #0d6efd; }
                     .course-code { font-weight: bold; color: #000; margin-bottom: 2px; }
                     .room-number { font-size: 0.95em; color: #495057; margin-bottom: 2px; }
                     .teacher-name { font-size: 0.95em; color: #6c757d; }
                     .table-responsive { overflow: hidden; }
                `}
      </style>
    </Container>
  );
};

export default RoutineView;
