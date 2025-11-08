const express = require('express');
const router = express.Router();
const axios = require('axios');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

router.post('/', async (req, res) => {
  const { audioUrl } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });

  if (!OPENAI_API_KEY) {
    return res.json({
      transcript: 'This is a mocked transcript. Set OPENAI_API_KEY to enable real transcription.',
      summary: 'Mock summary: action items: none.'
    });
  }

  try {
    const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(audioResp.data);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'recording.wav' });
    form.append('model', 'whisper-1');

    const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const transcript = resp.data.text || '';

    const summarizeResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a meeting assistant. Produce a concise summary and action items.' },
        { role: 'user', content: `Transcript:\n\n${transcript}` }
      ],
      max_tokens: 400
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });

    const summary = (summarizeResp.data.choices && summarizeResp.data.choices[0].message.content) || 'No summary';
    res.json({ transcript, summary });
  } catch (err) {
    console.error('transcription error', err.message || err);
    res.status(500).json({ error: 'transcription failed', details: err.message });
  }
});

module.exports = router;
