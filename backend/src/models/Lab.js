const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true, uppercase: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  year: { type: Number, required: true, min: 1, max: 4 },
  credits: { type: Number, default: 1, min: 1, max: 6 },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
}, { timestamps: true });

module.exports = mongoose.model('Lab', labSchema);
