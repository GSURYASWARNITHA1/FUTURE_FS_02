// ===================================================
// Mini CRM - CLEAN SERVER (FIXED VERSION)
// ===================================================

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'swarnitha';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'india';

// ---------------- Middleware ----------------
app.use(cors({
  origin: "https://your-frontend-domain",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- MongoDB ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ MongoDB error:", err.message));

// ---------------- Schemas ----------------
const leadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  source: String,
  message: String,
  status: { type: String, default: "new" },
  notes: [],
  createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.model("Lead", leadSchema);

const adminSchema = new mongoose.Schema({
  username: String,
  passwordHash: String
});

const Admin = mongoose.model("Admin", adminSchema);

// ---------------- Seed Admin ----------------
async function seedAdmin() {
  const exists = await Admin.findOne({ username: ADMIN_USERNAME });

  if (!exists) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await Admin.create({
      username: ADMIN_USERNAME,
      passwordHash: hash
    });
    console.log("✅ Admin created");
  }
}

// ---------------- Auth Middleware ----------------
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ===================================================
// AUTH ROUTES
// ===================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: "Invalid username" });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);

    if (!ok) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie('token', token, {
  httpOnly: true,
  sameSite: 'lax',
  secure: false   
});

    res.json({ message: "Login success" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.admin);
});

// ===================================================
// LEADS ROUTES
// ===================================================

app.post('/api/leads', async (req, res) => {
  const lead = await Lead.create(req.body);
  res.json(lead);
});

app.get('/api/leads', requireAuth, async (req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });
  res.json(leads);
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  await Lead.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ===================================================
// FRONTEND ROUTES
// ===================================================

app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
);

app.get('/dashboard', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
);

// ===================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  seedAdmin();
});
