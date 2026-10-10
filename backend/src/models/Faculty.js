const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  personalEmail: { type: String, trim: true, lowercase: true },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return /^[0-9\s\-\+\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 10;
      },
      message: 'Phone number must be valid (at least 10 digits)',
    },
  },
  address: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },
  qualification: { type: String, trim: true },
  experience: { type: Number, min: 0, default: 0 },
  joiningDate: {
    type: Date,
    validate: {
      validator: value => !value || value <= new Date(),
      message: 'Joining date cannot be in the future',
    },
  },
  subjectsTaught: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  profilePhotoUrl: String,
  signatureUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('Faculty', facultySchema);
