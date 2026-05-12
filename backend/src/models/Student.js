const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  enrollmentNo: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  // DOB: Date of birth with age validation (15-100 years old)
  dob: {
    type: Date,
    validate: {
      validator: function(v) {
        if (!v) return true; // optional field
        const age = (new Date() - v) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 15 && age <= 100;
      },
      message: 'Date of birth must represent a reasonable age (15-100 years)'
    }
  },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  // Personal email with format validation
  personalEmail: {
    type: String,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  signatureUrl: { type: String },
  // Phone number with format validation (at least 10 digits)
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[0-9\s\-\+\(\)]+$/.test(v) && v.replace(/\D/g, '').length >= 10;
      },
      message: 'Phone number must be valid (at least 10 digits)'
    }
  },
  address: String,
  branch: { type: String, required: true },
  currentSemester: { type: Number, required: true },
  section: String,
  // Admission year with 4-digit validation (1900 to current year + 1)
  admissionYear: {
    type: Number,
    validate: {
      validator: function(v) {
        if (!v) return true;
        const yearStr = String(v);
        return /^\d{4}$/.test(yearStr) && v >= 1900 && v <= new Date().getFullYear() + 1;
      },
      message: 'Please enter a valid 4-digit admission year'
    }
  },
  session: String,
  profilePhotoUrl: String,
  fatherName: String,
  motherName: String,
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
