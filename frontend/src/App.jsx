import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatPage from "./pages/Chat";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  useEffect(() => { const t = localStorage.getItem('token'); if (t) setToken(t); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onAuth={(t) => { localStorage.setItem('token', t); setToken(t); }} />} />
        <Route path="/register" element={<Register onAuth={(t) => { localStorage.setItem('token', t); setToken(t); }} />} />
        <Route path="/app" element={token ? <ChatPage token={token} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to="/app" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
