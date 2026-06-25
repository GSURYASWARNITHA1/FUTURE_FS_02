// ===============================
// Mini CRM - server.js (UPDATED FOR RENDER)
// ===============================

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Lead = require('./models/Lead');

const app = express();

// -------------------- Middleware --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: true,
  credentials: true
}));

// -------------------- Static --------------------
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- ENV --------------------
const PORT = process.env.PORT || 10000; // Render expects port 10000 or process.env.PORT
const MONGO_URI = process.env.MONGO_URI;

// -------------------- DB CONNECT --------------------
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    seedAdmin();
  })
  .catch(err => {
    console.error("❌ MongoDB error:", err.message);
  });

// -------------------- AUTH MIDDLEWARE --------------------
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

// -------------------- SEED ADMIN --------------------
async function seedAdmin() {
  try {
    const exists = await User.findOne({ username: 'admin' });

    if (!exists) {
      await User.create({
        username: 'admin',
        password: 'admin123'
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

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // FIXED: Added secure flag for production environments like Render
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || true 
    });

    res.json({
      message: "Login successful",
      user: { id: user._id, username: user.username }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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

app.post('/api/leads', async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: "Create failed" });
  }
});

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

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

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===============================
// FRONTEND ROUTES (ULTIMATE FALLBACK FIX)
// ===============================

// Serve static files from both lowercase 'public' and uppercase 'Public' if it exists
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'Public')));

// Home Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => {
    if (err) res.sendFile(path.join(__dirname, 'Public', 'index.html'), err2 => {
      if (err2) res.status(404).send("Not Found: index.html is missing from public folder");
    });
  });
});

// Login Route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'), err => {
    if (err) res.sendFile(path.join(__dirname, 'Public', 'login.html'), err2 => {
      if (err2) res.status(404).send("Not Found: login.html is missing from public folder");
    });
  });
});
// Dashboard Route (FORCED TYPO BYPASS)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'), err => {
    if (err) {
      // If dashboard.html fails, try searching for the misspelled version just in case
      res.sendFile(path.join(__dirname, 'public', 'dahsbaord.html'), err2 => {
        if (err2) {
          // If both fail, look for capital D
          res.sendFile(path.join(__dirname, 'public', 'Dashboard.html'), err3 => {
            if (err3) res.status(404).send("Not Found: No dashboard HTML file could be resolved in the folder structure.");
          });
        }
      });
    }
  });
});

// Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => {
    if (err) res.sendFile(path.join(__dirname, 'Public', 'index.html'), err2 => {
      if (err2) res.status(404).send("Not Found: Fallback failed");
    });
  });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
