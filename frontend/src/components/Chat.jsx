// frontend/src/pages/Chat.jsx
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import API from '../api/api';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ChatBox from '../components/ChatBox';
import MediasoupRoom from '../components/MediasoupRoom';
import Scheduler from '../components/Scheduler';

export default function Chat({ token }) {
  const [socket, setSocket] = useState(null);
  const [channel, setChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(()=>{
    const s = io(import.meta.env.VITE_WS_URL || 'http://localhost:4000', { auth: { token } });
    setSocket(s);
    s.on('connect', ()=> console.log('socket connected'));
    s.on('message:receive', (msg)=> setMessages(prev=>[...prev, msg]));
    s.on('presence:update', ({ userId, status })=> console.log('presence', userId, status));
    const maybe = JSON.parse(atob(token.split('.')[1]));
    setMe(maybe);
    return ()=> s.disconnect();
  },[]);

  useEffect(()=>{
    if(socket){
      socket.emit('join_team', { team: 'default' });
      socket.emit('join_channel', { channel });
    }
  },[socket, channel]);

  function onNavigate(to){
    if(to === 'schedule') { /* open scheduler UI or navigate */ }
    else if(to.startsWith('team_')) { /* team change */ }
    else { setChannel(to); }
  }

  async function onSend(content){
    socket.emit('message:send', { channel, content, team: 'default' });
  }

  function onLogout(){
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return (
    <div className="h-screen flex">
      <Sidebar user={me} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col">
        <Header title={`# ${channel}`} onLogout={onLogout} />
        <div className="flex-1 grid grid-cols-[1fr_360px]">
          <main className="p-4">
            <ChatBox messages={messages} onSend={onSend} />
            <div className="mt-4">
              <MediasoupRoom socket={socket} me={me} roomId={'main_room'} />
            </div>
          </main>
          <aside className="p-4 border-l">
            <Scheduler token={token} />
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Participants</h4>
              <div className="text-sm text-gray-600">List will show here</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
