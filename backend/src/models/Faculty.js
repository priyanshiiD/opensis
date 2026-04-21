const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: String,
  address: String,
  department: String,
  designation: String,
  qualification: String,
  joiningDate: Date,
  subjectsTaught: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  profilePhotoUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('Faculty', facultySchema);
