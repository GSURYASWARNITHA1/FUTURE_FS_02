// ===============================
// Mini CRM - server.js (CLEAN FIX)
// ===============================
const User = require('./models/User');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// -------------------------------
// App init (MUST BE FIRST)
// -------------------------------
const app = express();

// -------------------------------
// Middleware
// -------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Allow frontend cookies + requests
app.use(cors({
  origin: true,
  credentials: true
}));

// -------------------------------
// Static frontend (IMPORTANT)
// -------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------
// ENV
// -------------------------------
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// -------------------------------
// MongoDB Connection
// -------------------------------
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    seedAdmin();
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// -------------------------------
// Basic Models (if already in file, keep yours)
// -------------------------------
const Lead = require('./models/Lead');
const User = require('./models/User');

// -------------------------------
// Auth Middleware
// -------------------------------
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not logged in" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// -------------------------------
// Seed Admin
// -------------------------------
async function seedAdmin() {
  try {
    const exists = await User.findOne({ username: 'admin' });
    if (!exists) {
      await User.create({
        username: 'admin',
        password: 'admin123' // (you can hash later)
      });
      console.log("👤 Admin created");
    }
  } catch (err) {
    console.error("Seed error:", err.message);
  }
}

// ===============================
// AUTH ROUTES
// ===============================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    res.json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: "Logged out" });
});

// ===============================
// LEADS ROUTES
// ===============================

// Create lead
app.post('/api/leads', async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: "Create lead failed" });
  }
});

// Get leads
app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// Stats
app.get('/api/leads/stats', requireAuth, async (req, res) => {
  try {
    const total = await Lead.countDocuments();

    const statusCounts = await Lead.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.json({ total, statusCounts });
  } catch (err) {
    res.status(500).json({ error: "Stats failed" });
  }
});

// Update status
app.patch('/api/leads/:id/status', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Add note
app.post('/api/leads/:id/notes', requireAuth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });

    lead.notes.push({ text: req.body.text });
    await lead.save();

    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: "Note failed" });
  }
});

// Delete lead
app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===============================
// FRONTEND ROUTES
// ===============================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
