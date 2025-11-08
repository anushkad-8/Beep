import React, { useEffect, useRef, useState } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import API from '../api/api';

export default function MediasoupRoom({ socket, me, roomId }) {
  const localVideoRef = useRef();
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [producers, setProducers] = useState([]);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket?.on('room:peer-joined', async () => { await fetchProducers(); });
    socket?.on('room:peer-left', async () => { await fetchProducers(); });
    return () => {
      socket?.off('room:peer-joined');
      socket?.off('room:peer-left');
    };
  }, [socket]);

  async function fetchProducers() {
    const res = await API.get(`/mediasoup/rooms/${roomId}/producers`);
    setProducers(res.data || []);
  }

  async function join() {
    if (!socket) return alert('connect socket first');
    const rtp = (await API.get(`/mediasoup/rooms/${roomId}/rtpCapabilities`)).data.rtpCapabilities;
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtp });
    setDevice(device);

    const sendTransportParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
    const sendTransportLocal = device.createSendTransport({
      id: sendTransportParams.id,
      iceParameters: sendTransportParams.iceParameters,
      iceCandidates: sendTransportParams.iceCandidates,
      dtlsParameters: sendTransportParams.dtlsParameters
    });

    sendTransportLocal.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, { transportId: sendTransportLocal.id, dtlsParameters, peerId: socket.id });
        callback();
      } catch (e) {
        errback(e);
      }
    });

    sendTransportLocal.on('produce', async (parameters, callback, errback) => {
      try {
        const { kind, rtpParameters } = parameters;
        const res = await API.post(`/mediasoup/rooms/${roomId}/produce`, { transportId: sendTransportLocal.id, kind, rtpParameters, peerId: socket.id });
        callback({ id: res.data.id });
        socket.emit('producer:created', { roomId, producerId: res.data.id, peerId: socket.id });
      } catch (e) {
        errback(e);
      }
    });

    setSendTransport(sendTransportLocal);

    const recvTransportParams = (await API.post(`/mediasoup/rooms/${roomId}/create-transport`)).data;
    const recvTransportLocal = device.createRecvTransport({
      id: recvTransportParams.id,
      iceParameters: recvTransportParams.iceParameters,
      iceCandidates: recvTransportParams.iceCandidates,
      dtlsParameters: recvTransportParams.dtlsParameters
    });

    recvTransportLocal.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await API.post(`/mediasoup/rooms/${roomId}/transport-connect`, { transportId: recvTransportLocal.id, dtlsParameters, peerId: socket.id });
        callback();
      } catch (e) {
        errback(e);
      }
    });

    setRecvTransport(recvTransportLocal);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideoRef.current.srcObject = stream;

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    if (audioTrack) {
      await sendTransportLocal.produce({ track: audioTrack });
    }
    if (videoTrack) {
      await sendTransportLocal.produce({ track: videoTrack });
    }

    await fetchProducers();

    setJoined(true);
    socket.emit('join_room', { roomId });
  }

  return (
    <div className="p-3 border rounded">
      <h4 className="font-semibold">Meeting Room</h4>
      <div className="mt-2 flex space-x-2">
        <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={join} disabled={joined}>Join Room</button>
      </div>
      <div className="mt-3">
        <video ref={localVideoRef} autoPlay muted playsInline className="w-48 h-36 bg-black rounded" />
      </div>
      <div className="mt-3">
        <h5 className="font-semibold">Other producers</h5>
        <ul className="list-disc pl-5">
          {producers.map(p => <li key={p.id}>{p.peerId} - {p.kind}</li>)}
        </ul>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Note: For full automatic consumption of remote tracks, the server must implement consumer creation. This scaffold produces local tracks; extend the routes to create server-side consumers for automatic playback.
      </div>
    </div>
  );
}
