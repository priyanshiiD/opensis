const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Generate sample Excel files for bulk upload testing
 * Run with: node generate-samples.js (from backend directory)
 */

// Sample student data (10 test entries)
const studentData = [
  { rollNo: 'S1001', fullName: 'John Doe', email: 'john.doe@example.com', branch: 'Computer Science', semester: 3 },
  { rollNo: 'S1002', fullName: 'Jane Smith', email: 'jane.smith@example.com', branch: 'Electrical', semester: 2 },
  { rollNo: 'S1003', fullName: 'Michael Johnson', email: 'michael.j@example.com', branch: 'Computer Science', semester: 3 },
  { rollNo: 'S1004', fullName: 'Sarah Williams', email: 'sarah.w@example.com', branch: 'Mechanical', semester: 1 },
  { rollNo: 'S1005', fullName: 'David Brown', email: 'david.brown@example.com', branch: 'Civil', semester: 4 },
  { rollNo: 'S1006', fullName: 'Emily Davis', email: 'emily.davis@example.com', branch: 'Computer Science', semester: 2 },
  { rollNo: 'S1007', fullName: 'Robert Miller', email: 'robert.m@example.com', branch: 'Electrical', semester: 3 },
  { rollNo: 'S1008', fullName: 'Lisa Anderson', email: 'lisa.a@example.com', branch: 'Electronics', semester: 1 },
  { rollNo: 'S1009', fullName: 'James Wilson', email: 'james.w@example.com', branch: 'Computer Science', semester: 4 },
  { rollNo: 'S1010', fullName: 'Maria Garcia', email: 'maria.g@example.com', branch: 'Mechanical', semester: 2 },
];

// Sample faculty data (10 test entries)
const facultyData = [
  { employeeId: 'F1001', fullName: 'Dr. Alice Brown', email: 'alice.brown@example.com', department: 'Computer Science', designation: 'Professor' },
  { employeeId: 'F1002', fullName: 'Mr. Bob Green', email: 'bob.green@example.com', department: 'Mathematics', designation: 'Lecturer' },
  { employeeId: 'F1003', fullName: 'Dr. Carol White', email: 'carol.white@example.com', department: 'Electrical', designation: 'Associate Professor' },
  { employeeId: 'F1004', fullName: 'Mr. David Black', email: 'david.black@example.com', department: 'Computer Science', designation: 'Assistant Professor' },
  { employeeId: 'F1005', fullName: 'Dr. Emma Red', email: 'emma.red@example.com', department: 'Physics', designation: 'Professor' },
  { employeeId: 'F1006', fullName: 'Mr. Frank Gray', email: 'frank.gray@example.com', department: 'Chemistry', designation: 'Lecturer' },
  { employeeId: 'F1007', fullName: 'Dr. Grace Blue', email: 'grace.blue@example.com', department: 'Mechanical', designation: 'Associate Professor' },
  { employeeId: 'F1008', fullName: 'Mr. Henry Pink', email: 'henry.pink@example.com', department: 'Civil', designation: 'Lecturer' },
  { employeeId: 'F1009', fullName: 'Dr. Iris Yellow', email: 'iris.yellow@example.com', department: 'Electronics', designation: 'Professor' },
  { employeeId: 'F1010', fullName: 'Mr. Jack Purple', email: 'jack.purple@example.com', department: 'Computer Science', designation: 'Assistant Professor' },
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
    console.log('   1. docs/sample_students_bulk_upload.xlsx - 10 test students');
    console.log('   2. docs/sample_faculty_bulk_upload.xlsx - 10 test faculty members\n');
    console.log('💡 Usage: Upload these files via the admin dashboard bulk upload feature.\n');
  } catch (err) {
    console.error('❌ Error generating files:', err.message);
    process.exit(1);
  }
}

main();
