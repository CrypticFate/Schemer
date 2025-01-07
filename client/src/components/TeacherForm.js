import React, { useState } from 'react';

const TeacherForm = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const onSubmitForm = async (e) => {
        e.preventDefault();
        try {
            const body = { name, email };
            const response = await fetch('http://localhost:5000/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (response.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error(err.message);
        }
    };

    return (
        <div className="container mt-5">
            <h2>Add Teacher</h2>
            <form onSubmit={onSubmitForm}>
                <div className="form-group">
                    <input
                        type="text"
                        className="form-control"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Teacher Name"
                        required
                    />
                </div>
                <div className="form-group mt-3">
                    <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                    />
                </div>
                <button className="btn btn-success mt-3">Add</button>
            </form>
        </div>
    );
};

export default TeacherForm;
