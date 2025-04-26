import React, { useState, useEffect } from "react";
import axios from "axios";
import { Container, Form, Table, Button, Spinner } from "react-bootstrap";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const TeacherRoutine = () => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);

  const timeSlots = [
    "08:00 - 09:15",
    "09:15 - 10:30",
    "10:30 - 11:45",
    "11:45 - 13:00",
  ];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Fetch teachers who have allocations
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/teachers-with-allocations"
        );
        setTeachers(response.data);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };
    fetchTeachers();
  }, []);

  // Fetch teacher's routine when selected
  useEffect(() => {
    const fetchTeacherRoutine = async () => {
      if (!selectedTeacher) return;

      setLoading(true);
      try {
        const response = await axios.get(
          `http://localhost:5000/api/teachers/${selectedTeacher}/routine`
        );

        // Transform the data into a structured format
        const routineData = {};
        days.forEach((day) => {
          routineData[day] = {};
          timeSlots.forEach((slot) => {
            routineData[day][slot] = { course: null, room: null };
          });
        });

        response.data.forEach((allocation) => {
          const timeSlot = `${allocation.start_time.slice(
            0,
            -3
          )} - ${allocation.end_time.slice(0, -3)}`;
          if (!routineData[allocation.day_name]) {
            routineData[allocation.day_name] = {};
          }
          routineData[allocation.day_name][timeSlot] = {
            course: allocation.course_name,
            room: allocation.room_number,
          };
        });

        setRoutine(routineData);
      } catch (err) {
        console.error("Error fetching routine:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherRoutine();
  }, [selectedTeacher]);

  // Handle teacher selection
  const handleTeacherChange = (e) => {
    const teacherId = e.target.value;
    setSelectedTeacher(teacherId);

    // Find and set teacher email
    const teacher = teachers.find((t) => t.teacher_id.toString() === teacherId);
    setTeacherEmail(teacher ? teacher.email : "");
  };

  // Download as Image
  const downloadAsImage = () => {
    const element = document.getElementById("teacher-routine-table");
    html2canvas(element, { scale: 4 }).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${teacherEmail.split("@")[0]}_routine.png`;
      link.click();
    });
  };

  // Download as PDF
  const downloadAsPDF = () => {
    const element = document.getElementById("teacher-routine-table");
    html2canvas(element, { scale: 4 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfWidth = 297;
      const pdfHeight = 210;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const yPos = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, "PNG", 0, yPos, imgWidth, imgHeight);
      pdf.save(`${teacherEmail.split("@")[0]}_routine.pdf`);
    });
  };

  return (
    <Container>
      <h2 className="mb-4">Teacher's Routine</h2>

      <div className="row mb-4">
        <div className="col-md-6">
          <Form.Group>
            <Form.Label>Select Teacher</Form.Label>
            <Form.Select value={selectedTeacher} onChange={handleTeacherChange}>
              <option value="">Choose a teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>
                  {teacher.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="col-md-6">
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="text"
              value={teacherEmail}
              readOnly
              placeholder="No teacher selected"
            />
          </Form.Group>
        </div>
      </div>

      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        routine && (
          <>
            <div className="table-responsive" id="teacher-routine-table">
              <Table bordered hover className="routine-table">
                <thead className="table-dark">
                  <tr>
                    <th>Time / Day</th>
                    {days.map((day) => (
                      <th key={day}>{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot) => (
                    <tr key={timeSlot}>
                      <td className="time-slot">{timeSlot}</td>
                      {days.map((day) => (
                        <td key={`${day}-${timeSlot}`} className="routine-cell">
                          {routine[day][timeSlot]?.course ? (
                            <div className="class-slot">
                              <div className="course-name">
                                {routine[day][timeSlot].course}
                              </div>
                              <div className="room-number">
                                Room: {routine[day][timeSlot].room}
                              </div>
                            </div>
                          ) : (
                            <div className="empty-slot">No Class</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="mt-3">
              <Button
                variant="primary"
                className="me-2"
                onClick={downloadAsImage}
              >
                Download as Image
              </Button>
              <Button variant="success" onClick={downloadAsPDF}>
                Download as PDF
              </Button>
            </div>
          </>
        )
      )}

      <style jsx>{`
        .routine-table {
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

        .course-name {
          font-weight: bold;
          color: #0d6efd;
          margin-bottom: 4px;
        }

        .room-number {
          font-size: 0.9em;
          color: #198754;
        }
      `}</style>
    </Container>
  );
};

export default TeacherRoutine;
