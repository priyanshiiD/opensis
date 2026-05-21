const mongoose = require('mongoose');

const gradeBandSchema = new mongoose.Schema({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  grade: { type: String, required: true, trim: true },
  point: { type: Number, required: true },
}, { _id: false });

const gradingRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  bands: { type: [gradeBandSchema], required: true },
}, { timestamps: true });

module.exports = mongoose.model('GradingRule', gradingRuleSchema);
