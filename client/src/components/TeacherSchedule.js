import React, { useState, useEffect } from 'react';

const TeacherSchedule = ({ teacherId }) => {
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/teachers/${teacherId}/schedule`);
                if (!response.ok) {
                    throw new Error('Failed to fetch schedule');
                }
                const data = await response.json();
                setSchedule(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching schedule:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (teacherId) {
            fetchSchedule();
        }
    }, [teacherId]);

    const getDayName = (day) => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        return days[day - 1];
    };

    if (loading) return <div>Loading schedule...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!schedule.length) return <div>No schedule found for this teacher.</div>;

    return (
        <div className="container mt-4">
            <h3>Teacher's Schedule</h3>
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Time Slot</th>
                        <th>Course</th>
                        <th>Room</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.map((slot) => (
                        <tr key={slot.allocation_id}>
                            <td>{getDayName(slot.day_of_week)}</td>
                            <td>Block {slot.time_slot}</td>
                            <td>{slot.course_name}</td>
                            <td>{slot.room_number}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TeacherSchedule;
