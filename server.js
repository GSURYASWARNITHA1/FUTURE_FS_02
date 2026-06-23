require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

const NoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, default: '' },
  source: { type: String, default: 'Website Form' },
  message: { type: String, default: '' },
  status: { type: String, enum: ['new', 'contacted', 'converted'], default: 'new' },
  notes: { type: [NoteSchema], default: [] }
}, { timestamps: true });

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const Lead = mongoose.model('Lead', LeadSchema);
const Admin = mongoose.model('Admin', AdminSchema);

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided. Please log in.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Incorrect username or password.' });
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect username or password.' });
    const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, source, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required.' });
    const lead = await Lead.create({ name, email, phone, source, message });
    res.status(201).json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save your request. Please try again.' });
  }
});

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    res.json(await Lead.find().sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ error: 'Could not fetch leads.' });
  }
});

app.patch('/api/leads/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'converted'].includes(status)) return res.status(400).json({ error: 'Invalid status value.' });
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json(lead);
  } catch {
    res.status(500).json({ error: 'Could not update status.' });
  }
});

app.post('/api/leads/:id/notes', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required.' });
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text: text.trim(), at: new Date() } } },
      { new: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json(lead);
  } catch {
    res.status(500).json({ error: 'Could not save note.' });
  }
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not delete lead.' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'changeme';
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await Admin.findOne({ username });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Admin "${username}" password updated.`);
  } else {
    await Admin.create({ username, passwordHash });
    console.log(`Admin "${username}" created.`);
  }
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    if (process.argv.includes('--seed-admin')) {
      await seedAdmin();
      process.exit(0);
    }
    app.listen(PORT, () => console.log(`GSS CRM running on http://localhost:${PORT}`));
  })
  .catch(err => {
  console.error('FULL ERROR:');
  console.error(err);
  process.exit(1);
});