const ExcelJS = require('exceljs');

// Create a workbook with students data
const createStudentWorkbook = (students) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Define columns
  worksheet.columns = [
    { header: 'Enrollment No', key: 'enrollmentNo', width: 15 },
    { header: 'First Name', key: 'firstName', width: 15 },
    { header: 'Last Name', key: 'lastName', width: 15 },
    { header: 'Email', key: 'email', width: 20 },
    { header: 'Branch/Department', key: 'branch', width: 15 },
    { header: 'Current Semester', key: 'currentSemester', width: 15 },
    { header: 'Section', key: 'section', width: 10 },
    { header: 'Admission Year', key: 'admissionYear', width: 15 },
    { header: 'Session', key: 'session', width: 12 },
    { header: 'DOB', key: 'dob', width: 12 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Address', key: 'address', width: 25 },
    { header: 'Father Name', key: 'fatherName', width: 15 },
    { header: 'Mother Name', key: 'motherName', width: 15 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  students.forEach((student) => {
    const row = {
      enrollmentNo: student.enrollmentNo,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email || '',
      branch: student.branch,
      currentSemester: student.currentSemester,
      section: student.section || '',
      admissionYear: student.admissionYear,
      session: student.session || '',
      dob: student.dob ? new Date(student.dob).toLocaleDateString() : '',
      gender: student.gender || '',
      phone: student.phone || '',
      address: student.address || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
    };
    worksheet.addRow(row);
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
};

// Create a workbook with faculty data
const createFacultyWorkbook = (faculty) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faculty');

  // Define columns
  worksheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'First Name', key: 'firstName', width: 15 },
    { header: 'Last Name', key: 'lastName', width: 15 },
    { header: 'Email', key: 'email', width: 20 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Designation', key: 'designation', width: 15 },
    { header: 'Qualification', key: 'qualification', width: 20 },
    { header: 'Joining Date', key: 'joiningDate', width: 12 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Address', key: 'address', width: 25 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5C3E' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  faculty.forEach((member) => {
    const row = {
      employeeId: member.employeeId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email || '',
      department: member.department || '',
      designation: member.designation || '',
      qualification: member.qualification || '',
      joiningDate: member.joiningDate ? new Date(member.joiningDate).toLocaleDateString() : '',
      phone: member.phone || '',
      address: member.address || '',
    };
    worksheet.addRow(row);
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
};

module.exports = { createStudentWorkbook, createFacultyWorkbook };
