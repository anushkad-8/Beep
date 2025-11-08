Making this as part of my Computer Networks project for sem 5. Will later publish it too. 
Author: Anushka Dabhade
Read the important starter details below. Thanks!

Office Meetings Platform (with Mediasoup SFU) - Starter Repo
============================================================

What's included
----------------
- backend/: Node.js + Express + Socket.IO + Mediasoup SFU integration
- frontend/: React (Vite) + Tailwind UI with mediasoup-client usage for multi-party calls
- Transcription & summarization endpoint stubs (OpenAI placeholder)

Important notes
---------------
- This is a starter scaffold with a functional Mediasoup server skeleton and client integration.
  Mediasoup requires native binaries and system libraries. See Mediasoup docs for production setup.
- For WebRTC traversal you should deploy a TURN server (coturn) and configure ICE servers.
- For transcription/summarization you can configure OPENAI_API_KEY or replace with your STT provider.

Quick start (development)
-------------------------
1. Install backend dependencies:
   cd backend
   npm install
2. Install frontend dependencies:
   cd ../frontend
   npm install
3. Start backend:
   cd ../backend
   npm run dev
4. Start frontend:
   cd ../frontend
   npm run dev
5. Open http://localhost:5173 (Vite default)

Environment variables (backend/.env)
-----------------------------------
PORT=4000
MONGO_URI=mongodb://localhost:27017/office_meetings
JWT_SECRET=replace_this_with_a_secret
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET=your_bucket_name
S3_REGION=us-east-1
OPENAI_API_KEY=your_openai_key
MEDIASOUP_WORKER_PORT=2000
