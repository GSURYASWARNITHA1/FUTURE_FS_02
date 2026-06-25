const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  source: String,
  message: String,
  status: { type: String, default: 'new' },
  notes: [
    {
      text: String,
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
