const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  enrollmentNo: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  dob: Date,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  phone: String,
  address: String,
  branch: { type: String, required: true },
  currentSemester: { type: Number, required: true },
  section: String,
  admissionYear: Number,
  session: String,
  profilePhotoUrl: String,
  fatherName: String,
  motherName: String,
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
