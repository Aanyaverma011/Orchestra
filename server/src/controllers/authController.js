const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.findOne({ email: email.toLowerCase() })) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  // Role is never taken from the request: public sign-ups are always "user".
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role: 'user' });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

async function login(req, res) {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(user), user: publicUser(user) });
}

async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ user: publicUser(user) });
}

module.exports = { register, login, me, registerSchema, loginSchema };
