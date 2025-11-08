const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'devsecret';

function sign(user) {
  return jwt.sign({ id: user._id, email: user.email, name: user.name }, SECRET, { expiresIn: '7d' });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify };
