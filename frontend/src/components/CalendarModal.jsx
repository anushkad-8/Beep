// frontend/src/components/CalendarModal.jsx
import React, { useEffect, useState } from "react";
import API from "../api/api";

export default function CalendarModal({ onClose }) {
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    async function loadMeetings() {
      try {
        const res = await API.get("/meetings");
        const allMeetings = res.data || [];
        setMeetings(allMeetings);
      } catch (err) {
        console.error("Failed to load meetings:", err);
        setMeetings([]);
      }
    }
    loadMeetings();
  }, []);

  // Helper to normalize date
  function getStartTime(m) {
    return new Date(m.startTime || m.date);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#121b2c] w-[520px] rounded-xl shadow-lg p-6 text-gray-200 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-gray-200 text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-violet-300 mb-4">
          All Scheduled Meetings
        </h2>

        {meetings.length === 0 ? (
          <p className="text-gray-400 text-sm">No meetings scheduled yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
            {meetings.map((m) => {
              const start = getStartTime(m);
              const end = m.endTime ? new Date(m.endTime) : new Date(start.getTime() + (m.duration || 0) * 60000);
              const formattedTime = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
              const formattedEnd = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <li
                  key={m._id}
                  className="border border-gray-700 rounded-lg p-3 hover:bg-[#1d2a45] transition"
                >
                  <div className="font-semibold text-violet-300">{m.title}</div>
                  <div className="text-sm text-gray-400">
                    {formattedTime} → {formattedEnd}
                  </div>
                  {m.description && (
                    <div className="text-sm text-gray-400">{m.description}</div>
                  )}
                  {m.invitedUsers && m.invitedUsers.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Invited:{" "}
                      {m.invitedUsers.map((u) => u.name).join(", ") || "N/A"}
                    </div>
                  )}
                  <button
                    className="mt-2 px-3 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-sm"
                    onClick={() =>
                      alert(`Joining meeting: ${m.title}\nRoom: ${m.roomId || "main_room"}`)
                    }
                  >
                    Join Meeting
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
