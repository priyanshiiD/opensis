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
  department: { type: String, required: true }, // renamed from branch
  year: { type: Number, required: true }, // 1, 2, 3, 4
  semester: { type: String, required: true }, // e.g. "Jan-May", "July-Dec"
  section: { type: String, required: true },
  admissionYear: { type: Number, required: true },
  session: { type: String, required: true },
  profilePhotoUrl: String,
  fatherName: String,
  motherName: String,
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
