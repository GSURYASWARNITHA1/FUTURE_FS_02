// ===================================================
// Mini CRM - server.js
// Backend + Database models + API routes (all-in-one)
// ===================================================

require('dotenv').config();

console.log("MONGO_URI =", process.env.MONGO_URI);

const express = require('express');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.static("public"));
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'swarnitha';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'india';

// ---------- Middleware ----------
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- MongoDB Connection ----------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err.message));

// ---------- Lead Schema/Model ----------
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Social Media', 'Ad Campaign', 'Other'],
    default: 'Website'
  },
  message: { type: String, trim: true },
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted'],
    default: 'new'
  },
  notes: [
    {
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.model('Lead', leadSchema);

// ---------- Admin Schema/Model (hashed credentials, seeded on boot) ----------
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }
});
const Admin = mongoose.model('Admin', adminSchema);

async function seedAdmin() {
  try {
    const existing = await Admin.findOne({ username: ADMIN_USERNAME });
    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await Admin.create({ username: ADMIN_USERNAME, passwordHash: hash });
      console.log(`✅ Admin user seeded: ${ADMIN_USERNAME}`);
    }
  } catch (err) {
    console.error('Admin seed error:', err.message);
  }
}
mongoose.connection.on('connected', () => {
  console.log("MongoDB connected → running seedAdmin");
  seedAdmin();
});
mongoose.connection.once('open', async () => {
  const count = await Admin.countDocuments();

  if (count === 0) {
    const hash = await bcrypt.hash('india', 10);

    await Admin.create({
      username: 'swarnitha',
      passwordHash: hash
    });

    console.log("🔥 Forced admin created");
  }
});
// ---------- Auth Middleware ----------
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ===================================================
// AUTH ROUTES
// ===================================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!admin.passwordHash) {
      return res.status(500).json({ error: 'Admin not set up in DB' });
    }

    const match = await bcrypt.compare(password, admin.passwordHash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.json({ message: 'Login successful' });

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    return res.status(500).json({ error: 'Server crash during login' });
  }
});
// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Check session
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

// ===================================================
// LEAD ROUTES
// ===================================================

// Public: Create a new lead (from the public request/contact form)
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, source, message } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    const lead = await Lead.create({ name, email, phone, source, message });
    res.status(201).json({ message: 'Request submitted successfully', lead });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit request' });
  }
});

// Protected: Get all leads (with optional filters)
app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const leads = await Lead.find(filter).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch leads' });
  }
});

// Protected: Get dashboard stats (for charts)
app.get('/api/leads/stats', requireAuth, async (req, res) => {
  try {
    const total = await Lead.countDocuments();
    const statusCounts = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const sourceCounts = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Leads per day for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyCounts = await Lead.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ total, statusCounts, sourceCounts, dailyCounts });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch stats' });
  }
});

// Protected: Get single lead
app.get('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch lead' });
  }
});

// Protected: Update lead status
app.patch('/api/leads/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'converted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Could not update status' });
  }
});

// Protected: Add a note/follow-up to a lead
app.post('/api/leads/:id/notes', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Note text required' });
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    lead.notes.push({ text });
    await lead.save();
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Could not add note' });
  }
});

// Protected: Delete a lead
app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete lead' });
  }
});

// ===================================================
// FRONTEND PAGE ROUTES
// ===================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.listen(PORT, () => {
  console.log(`🚀 Mini CRM server running on port ${PORT}`)
});
