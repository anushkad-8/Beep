// frontend/src/components/Header.jsx
import React from "react";

export default function Header({ title, onLogout, onStartMeeting, onViewSchedule }) {
  return (
    <header className="w-full bg-[#071029] border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h3 className="text-violet-300 font-semibold text-lg">{title}</h3>
        <div className="text-sm text-gray-400 hidden md:block">Team workspace — stay connected</div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onStartMeeting}
          className="px-3 py-1 rounded bg-transparent border border-violet-600 text-violet-300 hover:bg-violet-700/10"
        >
          Start Meeting
        </button>

        <button
          onClick={onViewSchedule}
          className="bg-violet-700 hover:bg-violet-800 text-white px-4 py-2 rounded-md ml-3"
        >
          My Schedule 📅
        </button>

        <button
          onClick={onLogout}
          className="px-3 py-1 rounded bg-transparent border border-gray-700 text-gray-300 hover:bg-white/5"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
