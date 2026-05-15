const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ClassSchedule = require('../models/ClassSchedule');
const Result = require('../models/Result');
const Student = require('../models/Student');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isFutureDate = (date) => {
  if (!date) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date > endOfToday;
};

exports.getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { faculty: { ...faculty, officialEmail: faculty.userId?.email } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate('userId', 'email');
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });

    const allowed = ['email', 'phone', 'address', 'gender', 'qualification', 'experience', 'joiningDate'];
    const update = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const email = update.email?.trim().toLowerCase();
    if (email !== undefined) {
      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
      }
      const duplicate = await require('../models/User').findOne({ email, _id: { $ne: req.user._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      update.email = email;
    }

    if (update.experience !== undefined) {
      const experience = Number(update.experience);
      if (!Number.isFinite(experience) || experience < 0) {
        return res.status(400).json({ success: false, message: 'Experience must be a valid non-negative number' });
      }
      update.experience = experience;
    }

    if (update.joiningDate !== undefined) {
      const joiningDate = parseDateOnly(update.joiningDate);
      if (!joiningDate) {
        return res.status(400).json({ success: false, message: 'Please select a valid joining date' });
      }
      if (isFutureDate(joiningDate)) {
        return res.status(400).json({ success: false, message: 'Joining date cannot be in the future' });
      }
      update.joiningDate = joiningDate;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
    }

    if (update.email) {
      await require('../models/User').findByIdAndUpdate(req.user._id, { email: update.email }, { runValidators: true });
    }

    delete update.email;

    await Faculty.findByIdAndUpdate(faculty._id, update, { runValidators: true });

    const updated = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();

    res.json({ success: true, data: { faculty: { ...updated, officialEmail: updated.userId?.email } } });
  } catch (err) {
    const message = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(', ') : err.message;
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const subjects = await Subject.find({ facultyId: faculty._id }).lean();
    res.json({ success: true, data: { subjects } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const { subjectId, date, semester, branch, section, records } = req.body;
    const attendance = await Attendance.create({ subjectId, facultyId: faculty._id, date, semester, branch, section, records });
    res.status(201).json({ success: true, data: { attendance } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const filter = { facultyId: faculty._id };
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const records = await Attendance.find(filter)
      .populate('subjectId', 'code name')
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: { records } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;
    const assignment = await Assignment.create({ ...req.body, facultyId: faculty._id, fileUrl });
    res.status(201).json({ success: true, data: { assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const assignments = await Assignment.find({ facultyId: faculty._id })
      .populate('subjectId', 'code name')
      .lean();
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('submissions.studentId', 'firstName lastName enrollmentNo')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { submissions: assignment.submissions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { marks, feedback } = req.body;
    const assignment = await Assignment.findOne({ 'submissions._id': req.params.id });
    if (!assignment) return res.status(404).json({ success: false, message: 'Submission not found' });
    const sub = assignment.submissions.id(req.params.id);
    sub.marks = marks;
    sub.feedback = feedback;
    await assignment.save();
    res.json({ success: true, message: 'Graded' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Grade calculation helpers
const calcGrade = (totalMarks) => {
  if (totalMarks >= 90) return 'O';
  if (totalMarks >= 75) return 'A+';
  if (totalMarks >= 60) return 'A';
  if (totalMarks >= 50) return 'B+';
  if (totalMarks >= 40) return 'B';
  return 'F';
};

const calcGradePoints = (totalMarks) => {
  if (totalMarks >= 90) return 10;
  if (totalMarks >= 75) return 9;
  if (totalMarks >= 60) return 8;
  if (totalMarks >= 50) return 7;
  if (totalMarks >= 40) return 6;
  return 0;
};

exports.updateMarks = async (req, res) => {
  try {
    const { semester, session, entries } = req.body;
    for (const entry of entries) {
      const { studentId, subjectId, internalMarks, externalMarks } = entry;
      const totalMarks = (internalMarks || 0) + (externalMarks || 0);
      const grade = calcGrade(totalMarks);
      const gradePoints = calcGradePoints(totalMarks);

      // Get subject credits
      const subject = await Subject.findById(subjectId).lean();
      const credits = subject?.credits || 3;
      const creditPoints = gradePoints * credits;

      // Get student for branch info
      const student = await Student.findById(studentId).lean();

      // Enrollment check
      if (student && subject && student.branch !== subject.branch) {
        throw new Error(`Enrollment Mismatch: Student ${student.enrollmentNo} is from ${student.branch}, cannot assign marks for ${subject.branch} subject`);
      }
      if (student && subject && student.currentSemester < subject.semester) {
        throw new Error(`Semester Mismatch: Student ${student.enrollmentNo} is in Sem ${student.currentSemester}, but this subject is for Sem ${subject.semester}`);
      }

      let result = await Result.findOne({ studentId, semester, session });
      if (!result) result = new Result({ studentId, semester, session, branch: student?.branch, subjectMarks: [] });

      const existing = result.subjectMarks.findIndex(s => s.subjectId?.toString() === subjectId);
      const markEntry = { subjectId, internalMarks, externalMarks, totalMarks, grade, gradePoints, credits, creditPoints };
      if (existing >= 0) result.subjectMarks[existing] = markEntry;
      else result.subjectMarks.push(markEntry);

      await result.save();
    }
    res.json({ success: true, message: 'Marks updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMarks = async (req, res) => {
  try {
    const { semester, session, subjectId } = req.query;
    const filter = {};
    if (semester) filter.semester = Number(semester);
    if (session) filter.session = session;
    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo')
      .populate('subjectMarks.subjectId', 'code name credits')
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload marks via Excel
exports.bulkUploadMarks = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, semester, session } = req.body;
    if (!subjectId || !semester || !session) {
      return res.status(400).json({ success: false, message: 'subjectId, semester, and session are required' });
    }

    const xlsx = require('xlsx');
    const fs = require('fs');

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const credits = subject.credits || 3;

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const enrollmentNo = String(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo || '').trim();
        const internalMarks = Number(row.internalMarks || row.InternalMarks || row.internal || row.Internal || 0);
        const externalMarks = Number(row.externalMarks || row.ExternalMarks || row.external || row.External || 0);

        if (!enrollmentNo) {
          results.failed.push({ row: idx + 2, reason: 'Missing enrollment number' });
          continue;
        }

        if (internalMarks < 0 || internalMarks > 40) {
          results.failed.push({ row: idx + 2, reason: `Internal marks must be 0-40 (got ${internalMarks})`, enrollmentNo });
          continue;
        }
        if (externalMarks < 0 || externalMarks > 60) {
          results.failed.push({ row: idx + 2, reason: `External marks must be 0-60 (got ${externalMarks})`, enrollmentNo });
          continue;
        }

        const student = await Student.findOne({ enrollmentNo }).lean();
        if (!student) {
          results.failed.push({ row: idx + 2, reason: 'Student not found in system', enrollmentNo });
          continue;
        }

        // Enrollment check: branch must match subject branch
        if (student.branch !== subject.branch) {
          results.failed.push({ 
            row: idx + 2, 
            reason: `Enrollment Mismatch: Student is from ${student.branch}, but this subject is for ${subject.branch}`, 
            enrollmentNo 
          });
          continue;
        }

        // Semester check: Ensure student is in (or has passed) the semester of the subject
        if (student.currentSemester < subject.semester) {
          results.failed.push({
            row: idx + 2,
            reason: `Semester Mismatch: Student is in Sem ${student.currentSemester}, but this subject is for Sem ${subject.semester}`,
            enrollmentNo
          });
          continue;
        }

        const totalMarks = internalMarks + externalMarks;
        const grade = calcGrade(totalMarks);
        const gradePoints = calcGradePoints(totalMarks);
        const creditPoints = gradePoints * credits;

        let result = await Result.findOne({ studentId: student._id, semester: Number(semester), session });
        if (!result) {
          result = new Result({
            studentId: student._id,
            semester: Number(semester),
            session,
            branch: student.branch,
            subjectMarks: [],
          });
        }

        const existingIdx = result.subjectMarks.findIndex(s => s.subjectId?.toString() === subjectId);
        const markEntry = { subjectId, internalMarks, externalMarks, totalMarks, grade, gradePoints, credits, creditPoints };

        if (existingIdx >= 0) result.subjectMarks[existingIdx] = markEntry;
        else result.subjectMarks.push(markEntry);

        await result.save();
        results.success.push({ row: idx + 2, enrollmentNo, totalMarks, grade });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row' });
      }
    }

    // cleanup uploaded file
    try { require('fs').unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subjectId, semester, session } = req.query;
    if (!subjectId || !semester || !session) return res.status(400).json({ success: false, message: 'subjectId, semester, and session required' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    // Find students in this branch and semester
    const students = await Student.find({ 
      branch: subject.branch,
      currentSemester: Number(semester) 
    }).sort({ enrollmentNo: 1 }).lean();

    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this branch and semester' });

    // Find existing results to pre-fill marks if any
    const results = await Result.find({ semester: Number(semester), session }).lean();

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code} Marks`);

    // Add columns
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'internalMarks', key: 'internalMarks', width: 15 },
      { header: 'externalMarks', key: 'externalMarks', width: 15 },
      { header: 'studentName', key: 'studentName', width: 30 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data
    for (const student of students) {
      // Look for existing marks for this student and subject
      const result = results.find(r => r.studentId?.toString() === student._id.toString());
      let internal = '';
      let external = '';

      if (result) {
        const sm = (result.subjectMarks || []).find(s => s.subjectId?.toString() === subjectId);
        if (sm) {
          internal = sm.internalMarks ?? '';
          external = sm.externalMarks ?? '';
        }
      }

      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        internalMarks: internal,
        externalMarks: external,
      });
    }

    const filename = `MarksTemplate_${subject.code}_Sem${semester}_${session}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ audience: { $in: ['all', 'faculty'] } })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const schedules = await ClassSchedule.find({ 'timetable.facultyId': faculty._id })
      .populate('timetable.subjectId', 'code name')
      .populate('timetable.facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
