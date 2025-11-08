// frontend/src/components/Scheduler.jsx
import React, { useEffect, useState } from "react";
import API from "../api/api";

export default function Scheduler({ token }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [invitees, setInvitees] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await API.get("/users");
        setUsers(res.data || []);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
  }, []);

  async function scheduleMeeting(e) {
    e.preventDefault();
    const datetime = new Date(`${date}T${time}:00`);
    try {
      await API.post("/meetings", {
        title,
        description,
        date: datetime,
        duration: parseInt(duration),
        invitedUsers: invitees,
        createdBy: JSON.parse(atob(token.split(".")[1])).id,
      });
      setMessage("✅ Meeting scheduled successfully!");
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setDuration(30);
      setInvitees([]);
    } catch {
      setMessage("❌ Error scheduling meeting");
    }
  }

  return (
    <div className="bg-[#0f1724] p-5 rounded-xl shadow-md text-gray-200">
      <h3 className="text-lg font-semibold text-violet-300 mb-3">Schedule a Meeting</h3>
      <form onSubmit={scheduleMeeting} className="flex flex-col gap-3">
        <input
          className="bg-transparent border border-gray-700 rounded px-3 py-2"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="bg-transparent border border-gray-700 rounded px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-3">
          <input
            type="date"
            className="flex-1 bg-transparent border border-gray-700 rounded px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <input
            type="time"
            className="flex-1 bg-transparent border border-gray-700 rounded px-3 py-2"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
        <input
          type="number"
          min="5"
          className="bg-transparent border border-gray-700 rounded px-3 py-2"
          placeholder="Duration (minutes)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
        />
        <select
          multiple
          className="bg-transparent border border-gray-700 rounded px-3 py-2 h-24"
          value={invitees}
          onChange={(e) => setInvitees([...e.target.selectedOptions].map((o) => o.value))}
        >
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-gradient-to-r from-violet-600 to-indigo-600 py-2 rounded-md mt-1"
        >
          Schedule
        </button>
      </form>
      {message && <div className="text-sm text-violet-300 mt-3">{message}</div>}
    </div>
  );
}
