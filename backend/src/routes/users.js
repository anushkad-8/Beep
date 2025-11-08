// backend/src/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/users — list all users (safe fields)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0, __v: 0 });
    res.json(users);
  } catch (err) {
    console.error("users list error", err);
    res.status(500).json({ error: "could not fetch users" });
  }
});

module.exports = router;
