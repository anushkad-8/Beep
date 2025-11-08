import React, { useState } from 'react';
import API from '../api/api';
import { useNavigate } from 'react-router-dom';

export default function Login({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigate();
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await API.post('/auth/login', { email, password });
      const { token } = res.data;
      onAuth(token);
      nav('/app');
    } catch (error) {
      setErr(error.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="p-8 bg-white rounded shadow w-full max-w-md">
        <h2 className="text-2xl mb-4">Login</h2>
        {err && <div className="text-red-600 mb-2">{err}</div>}
        <input required className="w-full p-2 border my-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input required type="password" className="w-full p-2 border my-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white p-2 mt-4 rounded">Login</button>
      </form>
    </div>
  );
}
