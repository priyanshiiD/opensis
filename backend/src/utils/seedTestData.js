const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

/**
 * Realistic Indian student names and emails for testing
 */
const testStudentData = [
  { firstName: 'Rahul', lastName: 'Sharma', email: 'rahul.sharma@college.edu' },
  { firstName: 'Priya', lastName: 'Verma', email: 'priya.verma@college.edu' },
  { firstName: 'Arjun', lastName: 'Kumar', email: 'arjun.kumar@college.edu' },
  { firstName: 'Isha', lastName: 'Patel', email: 'isha.patel@college.edu' },
  { firstName: 'Aditya', lastName: 'Singh', email: 'aditya.singh@college.edu' },
  { firstName: 'Sneha', lastName: 'Gupta', email: 'sneha.gupta@college.edu' },
  { firstName: 'Vikram', lastName: 'Reddy', email: 'vikram.reddy@college.edu' },
  { firstName: 'Anjali', lastName: 'Desai', email: 'anjali.desai@college.edu' },
  { firstName: 'Rohan', lastName: 'Nair', email: 'rohan.nair@college.edu' },
  { firstName: 'Divya', lastName: 'Iyer', email: 'divya.iyer@college.edu' },
];

/**
 * Realistic Indian faculty names and emails for testing
 */
const testFacultyData = [
  { firstName: 'Amit', lastName: 'Mishra', email: 'amit.sir@college.edu', title: 'Dr.' },
  { firstName: 'Neha', lastName: 'Bhat', email: 'neha.mam@college.edu', title: 'Dr.' },
  { firstName: 'Rajesh', lastName: 'Joshi', email: 'rajesh.sir@college.edu', title: 'Prof.' },
  { firstName: 'Priyanka', lastName: 'Rao', email: 'priyanka.mam@college.edu', title: 'Dr.' },
  { firstName: 'Sanjay', lastName: 'Chopra', email: 'sanjay.sir@college.edu', title: 'Prof.' },
  { firstName: 'Meera', lastName: 'Menon', email: 'meera.mam@college.edu', title: 'Dr.' },
  { firstName: 'Ashok', lastName: 'Bansal', email: 'ashok.sir@college.edu', title: 'Prof.' },
  { firstName: 'Kavya', lastName: 'Sharma', email: 'kavya.mam@college.edu', title: 'Dr.' },
  { firstName: 'Nitin', lastName: 'Saxena', email: 'nitin.sir@college.edu', title: 'Prof.' },
  { firstName: 'Shreya', lastName: 'Das', email: 'shreya.mam@college.edu', title: 'Dr.' },
];

/**
 * Generate 10 dummy student accounts for testing
 * Used only for development/testing purposes
 */
async function createTestStudents() {
  const branches = ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Electronics & Communication'];
  const students = [];
  const users = [];

  for (let i = 0; i < testStudentData.length; i++) {
    const { firstName, lastName, email } = testStudentData[i];
    const rollNo = `TS${String(i + 1).padStart(4, '0')}`;
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const branch = branches[i % branches.length];
    const semester = (i % 8) + 1;

    // Hash password
    const passwordHash = await bcrypt.hash('Welcome@123', 12);

    // User record
    users.push({
      email,
      passwordHash,
      role: 'student',
      username,
      isActive: true,
    });

    // Student record (we'll link after users are created)
    students.push({
      enrollmentNo: rollNo,
      firstName,
      lastName,
      branch,
      currentSemester: semester,
      year: Math.ceil(semester / 2),
      session: '2024-25',
    });
  }

  return { users, students };
}

/**
 * Generate 10 dummy faculty accounts for testing
 */
async function createTestFaculty() {
  const departments = ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Electrical Engineering'];
  const designations = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];
  const faculty = [];
  const users = [];

  for (let i = 0; i < testFacultyData.length; i++) {
    const { firstName, lastName, email } = testFacultyData[i];
    const employeeId = `EMPL${String(i + 1).padStart(5, '0')}`;
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const department = departments[i % departments.length];
    const designation = designations[i % designations.length];

    // Hash password
    const passwordHash = await bcrypt.hash('Welcome@123', 12);

    // User record
    users.push({
      email,
      passwordHash,
      role: 'faculty',
      username,
      isActive: true,
    });

    // Faculty record
    faculty.push({
      employeeId,
      firstName,
      lastName,
      department,
      designation,
    });
  }

  return { users, faculty };
}

/**
 * Seed test data into database
 * @returns {Object} Results with success/failure counts
 */
async function seedTestData() {
  try {
    // Generate test data
    const studentData = await createTestStudents();
    const facultyData = await createTestFaculty();

    const results = {
      studentsCreated: 0,
      facultyCreated: 0,
      studentsSkipped: 0,
      facultySkipped: 0,
      errors: [],
    };

    // Create student users and records
    for (let i = 0; i < studentData.users.length; i++) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: studentData.users[i].email });
        if (existingUser) {
          results.studentsSkipped += 1;
          continue;
        }

        // Create user
        const user = await User.create(studentData.users[i]);

        // Create student record
        const studentRecord = {
          ...studentData.students[i],
          userId: user._id,
        };
        await Student.create(studentRecord);

        results.studentsCreated += 1;
      } catch (err) {
        results.errors.push({
          type: 'student',
          index: i + 1,
          email: studentData.users[i].email,
          message: err.message,
        });
      }
    }

    // Create faculty users and records
    for (let i = 0; i < facultyData.users.length; i++) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: facultyData.users[i].email });
        if (existingUser) {
          results.facultySkipped += 1;
          continue;
        }

        // Create user
        const user = await User.create(facultyData.users[i]);

        // Create faculty record
        const facultyRecord = {
          ...facultyData.faculty[i],
          userId: user._id,
        };
        await Faculty.create(facultyRecord);

        results.facultyCreated += 1;
      } catch (err) {
        results.errors.push({
          type: 'faculty',
          index: i + 1,
          email: facultyData.users[i].email,
          message: err.message,
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(`Seed data creation failed: ${err.message}`);
  }
}

module.exports = {
  seedTestData,
  createTestStudents,
  createTestFaculty,
  testStudentData,
  testFacultyData,
};
