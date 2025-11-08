const express = require('express');
const router = express.Router();
const { createRoom, getRoom } = require('./mediasoupServer');

router.get('/rooms/:roomId/rtpCapabilities', async (req, res) => {
  const { roomId } = req.params;
  const room = await createRoom(roomId);
  res.json({ rtpCapabilities: room.router.rtpCapabilities });
});

router.post('/rooms/:roomId/create-transport', async (req, res) => {
  const { roomId } = req.params;
  const room = await createRoom(roomId);

  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  });

  room.transports.set(transport.id, transport);

  res.json({
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  });
});

router.post('/rooms/:roomId/transport-connect', async (req, res) => {
  const { roomId } = req.params;
  const { transportId, dtlsParameters, peerId } = req.body;
  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const transport = room.transports.get(transportId);
  if (!transport) return res.status(404).json({ error: 'transport not found' });
  await transport.connect({ dtlsParameters });
  const p = room.peers.get(peerId) || { transports: new Set(), producers: new Set() };
  p.transports.add(transportId);
  room.peers.set(peerId, p);
  res.json({ ok: true });
});

router.post('/rooms/:roomId/produce', async (req, res) => {
  const { roomId } = req.params;
  const { transportId, kind, rtpParameters, peerId } = req.body;
  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const transport = room.transports.get(transportId);
  if (!transport) return res.status(404).json({ error: 'transport not found' });

  const producer = await transport.produce({ kind, rtpParameters, appData: { peerId } });
  room.producers.set(producer.id, { producer, peerId });

  const p = room.peers.get(peerId) || { transports: new Set(), producers: new Set() };
  p.producers.add(producer.id);
  room.peers.set(peerId, p);

  res.json({ id: producer.id });
});

router.get('/rooms/:roomId/producers', async (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const list = [];
  for (const [id, item] of room.producers.entries()) {
    list.push({ id, peerId: item.peerId, kind: item.producer.kind, appData: item.producer.appData });
  }
  res.json(list);
});

router.get('/rooms/:roomId/producer/:producerId/rtpParameters', async (req, res) => {
  const { roomId, producerId } = req.params;
  const room = getRoom(roomId);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const p = room.producers.get(producerId);
  if (!p) return res.status(404).json({ error: 'producer not found' });
  res.json({ producerId, kind: p.producer.kind });
});

module.exports = router;
