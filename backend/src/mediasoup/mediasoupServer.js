const mediasoup = require('mediasoup');

const config = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp']
  },
  router: {
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }
    ]
  }
};

let worker = null;
const rooms = new Map();

async function initMediasoup() {
  if (worker) return;
  worker = await mediasoup.createWorker({
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
    logLevel: config.worker.logLevel
  });
  worker.on('died', () => {
    console.error('mediasoup worker died, exiting');
    setTimeout(() => process.exit(1), 2000);
  });
  console.log('mediasoup worker created, pid', worker.pid);
}

async function createRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
  const room = {
    router,
    transports: new Map(),
    producers: new Map(),
    peers: new Map()
  };
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

module.exports = { initMediasoup, createRoom, getRoom };
