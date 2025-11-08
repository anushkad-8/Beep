const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sign } = require('../utils/jwt');

router.post('/register', async (req, res) => {
  const { name, email, password, team } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'email exists' });
  const user = new User({ name, email, team });
  await user.setPassword(password);
  await user.save();
  const token = sign(user);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, team: user.team } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await user.validatePassword(password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = sign(user);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, team: user.team } });
});

module.exports = router;
