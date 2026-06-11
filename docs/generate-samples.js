const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Generate sample Excel files for bulk upload testing
 * Run with: node generate-samples.js (from backend directory)
 */

// Sample student data (2 test entries)
const studentData = [
  { rollNo: 'STU001', fullName: 'Rahul Sharma', email: 'rahul.sharma@college.edu', branch: 'IT', semester: 1 },
  { rollNo: 'STU002', fullName: 'Priya Verma', email: 'priya.verma@college.edu', branch: 'CSE', semester: 3 },
];

// Sample faculty data (2 test entries)
const facultyData = [
  { employeeId: 'FAC001', fullName: 'Amit Mishra', email: 'amit.mishra@college.edu', department: 'IT', designation: 'Professor' },
  { employeeId: 'FAC002', fullName: 'Neha Bhat', email: 'neha.bhat@college.edu', department: 'CSE', designation: 'Assistant Professor' },
];

async function generateStudentExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Add header row
  worksheet.columns = [
    { header: 'rollNo', key: 'rollNo', width: 12 },
    { header: 'fullName', key: 'fullName', width: 20 },
    { header: 'email', key: 'email', width: 25 },
    { header: 'branch', key: 'branch', width: 18 },
    { header: 'semester', key: 'semester', width: 10 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  studentData.forEach(student => {
    worksheet.addRow(student);
  });

  // Center align semester column
  worksheet.getColumn('semester').alignment = { horizontal: 'center' };

  // Save file
  const filePath = path.join(__dirname, 'sample_students_bulk_upload.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Created: ${filePath}`);
}

async function generateFacultyExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faculty');

  // Add header row
  worksheet.columns = [
    { header: 'employeeId', key: 'employeeId', width: 12 },
    { header: 'fullName', key: 'fullName', width: 20 },
    { header: 'email', key: 'email', width: 25 },
    { header: 'department', key: 'department', width: 18 },
    { header: 'designation', key: 'designation', width: 20 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  facultyData.forEach(faculty => {
    worksheet.addRow(faculty);
  });

  // Save file
  const filePath = path.join(__dirname, 'sample_faculty_bulk_upload.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Created: ${filePath}`);
}

async function main() {
  try {
    console.log('📊 Generating sample Excel files...\n');
    await generateStudentExcel();
    await generateFacultyExcel();
    console.log('\n✨ Sample files generated successfully!\n');
    console.log('📝 Files created:');
    console.log('   1. docs/sample_students_bulk_upload.xlsx - 2 test students');
    console.log('   2. docs/sample_faculty_bulk_upload.xlsx - 2 test faculty members\n');
    console.log('💡 Usage: Upload these files via the admin dashboard bulk upload feature.\n');
  } catch (err) {
    console.error('❌ Error generating files:', err.message);
    process.exit(1);
  }
}

main();
