// frontend/src/components/Sidebar.jsx
import React from "react";

function Avatar({ name }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br from-violet-600 to-indigo-600">
      {name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

export default function Sidebar({ user, users = [], channel, onNavigate }) {
  return (
    <aside className="w-72 bg-[#0f1724] text-gray-200 h-screen flex flex-col border-r border-gray-800">
      <div className="px-4 py-5 flex items-center gap-3 border-b border-gray-800">
        <Avatar name={user?.name} />
        <div className="flex-1">
          <div className="text-sm font-semibold">{user?.name || "You"}</div>
          <div className="text-xs text-gray-400">{user?.email || ""}</div>
        </div>
      </div>

      <div className="px-4 py-3 text-xs text-gray-400">TEAMS</div>
      <button
        onClick={() => onNavigate({ type: "team", id: "default", label: "Default Team" })}
        className={`px-4 py-2 text-left hover:bg-[#0b1220] transition-colors ${channel?.type === "team" ? "bg-[#0b1220] border-l-4 border-violet-500" : ""}`}
      >
        <div className="font-medium">Default Team</div>
      </button>

      <div className="px-4 py-3 mt-4 text-xs text-gray-400">CHANNELS</div>
      <div className="flex flex-col px-2 gap-1">
        <button onClick={() => onNavigate({ type: "channel", id: "general", label: "# general" })}
                className={`px-3 py-2 rounded-md text-left hover:bg-[#0b1220] transition ${channel?.id === "general" ? "bg-[#0b1220] border-l-4 border-violet-500" : ""}`}>
          # general
        </button>
        <button onClick={() => onNavigate({ type: "channel", id: "random", label: "# random" })}
                className={`px-3 py-2 rounded-md text-left hover:bg-[#0b1220] transition ${channel?.id === "random" ? "bg-[#0b1220] border-l-4 border-violet-500" : ""}`}>
          # random
        </button>
      </div>

      <div className="px-4 py-3 mt-6 text-xs text-gray-400">DIRECT MESSAGES</div>
      <div className="px-2 overflow-auto flex-1">
        {users.length === 0 && <div className="text-sm text-gray-500 px-3 py-2">No users found</div>}
        {users.map(u => (
          <button key={u._id}
                  onClick={() => onNavigate({ type: "dm", id: u._id, label: u.name, userId: u._id })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[#0b1220] transition ${channel?.type === "dm" && channel?.id === u._id ? "bg-[#0b1220] border-l-4 border-violet-500" : ""}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-violet-700 text-white text-sm font-medium">
              {u.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm">{u.name}</div>
              <div className="text-xs text-gray-400 truncate">{u.email}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800">
        <button onClick={() => onNavigate({ type: "schedule" })} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-2 rounded-md shadow">
          Schedule Meeting
        </button>
      </div>
    </aside>
  );
}
