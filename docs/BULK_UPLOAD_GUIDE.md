# Bulk Enrollment System - Documentation

## Overview

The **Bulk Enrollment System** allows administrators to efficiently enroll multiple students and faculty members by uploading Excel files instead of creating accounts one by one.

### Key Features

- ✅ Upload multiple students/faculty in a single Excel file
- ✅ Automatic username generation (from email or name)
- ✅ Default password assignment with hashing (bcrypt)
- ✅ Duplicate detection (email & roll number/employee ID)
- ✅ Row-level error handling with detailed feedback
- ✅ Production-ready error handling and validation

---

## Architecture

### Backend Structure

```
backend/
├── src/
│   ├── middleware/
│   │   └── excelUpload.js           # Multer configuration for Excel files
│   ├── controllers/
│   │   └── adminController.js       # Contains bulkUploadStudents & bulkUploadFaculty
│   ├── routes/
│   │   └── admin.js                 # POST /admin/students/bulk-upload
│   ├── models/
│   │   ├── User.js                  # Updated with username field
│   │   ├── Student.js
│   │   └── Faculty.js
│   └── uploads/                     # Temporary Excel file storage
├── package.json                     # Includes xlsx, multer, bcrypt
└── server.js
```

### Frontend Structure

```
frontend/
├── src/
│   ├── pages/admin/
│   │   ├── BulkUploadStudents.jsx   # Student upload page
│   │   └── BulkUploadFaculty.jsx    # Faculty upload page
│   └── api/
│       └── axios.js                 # API client with interceptors
```

---

## API Endpoints

### 1. Student Bulk Upload

**Endpoint:** `POST /api/admin/students/bulk-upload`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request:**

```
Body: FormData {
  file: <.xlsx or .xls or .csv file>
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": [
      {
        "row": 2,
        "userId": "6789abcd...",
        "studentId": "5678bcde...",
        "email": "john.doe@example.com",
        "rollNo": "S1001"
      }
    ],
    "failed": [
      {
        "row": 5,
        "reason": "Duplicate email",
        "data": { "email": "existing@example.com" }
      }
    ]
  }
}
```

### 2. Faculty Bulk Upload

**Endpoint:** `POST /api/admin/faculty/bulk-upload`

**Headers:** Same as students

**Request:** Same structure (FormData with file)

**Response:** Same structure with faculty details

---

## Excel File Format

### Student Upload Format

| rollNo | fullName   | email                  | branch           | semester |
| ------ | ---------- | ---------------------- | ---------------- | -------- |
| S1001  | John Doe   | john.doe@example.com   | Computer Science | 3        |
| S1002  | Jane Smith | jane.smith@example.com | Electrical       | 2        |

**Field Requirements:**

- `rollNo` (required): Unique identifier, no duplicates allowed
- `fullName` (required): Can contain spaces, auto-split into firstName/lastName
- `email` (required): Valid email, must be unique
- `branch` (required): Department/branch name
- `semester` (required): Current semester number (integer)

### Faculty Upload Format

| employeeId | fullName  | email             | department       | designation |
| ---------- | --------- | ----------------- | ---------------- | ----------- |
| F1001      | Dr. Alice | alice@example.com | Computer Science | Professor   |
| F1002      | Mr. Bob   | bob@example.com   | Mathematics      | Lecturer    |

**Field Requirements:**

- `employeeId` (required): Unique identifier, no duplicates
- `fullName` (required): Can contain spaces, auto-split
- `email` (required): Valid email, must be unique
- `department` (required): Department name
- `designation` (required): Position/title

---

## How It Works

### Backend Processing Flow

1. **File Upload (Multer)**
   - Middleware validates file type (.xlsx, .xls, .csv)
   - Max file size: 15 MB
   - File saved temporarily in `/uploads` folder

2. **Excel Parsing (xlsx)**

   ```javascript
   const workbook = xlsx.readFile(req.file.path);
   const sheet = workbook.Sheets[workbook.SheetNames[0]];
   const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
   ```

3. **Row Processing**
   - Trim whitespace from all fields
   - Case-insensitive matching for alternatives (e.g., `rollNo` or `RollNo`)
   - Validate required fields
   - Check for duplicates in database
   - Split fullName into firstName/lastName

4. **Account Creation**

   ```javascript
   // Generate unique username
   const base = email.split("@")[0]; // e.g., "john.doe"
   let username = base;
   while (await User.findOne({ username })) {
     username = base + ++counter;
   }

   // Hash password
   const passwordHash = await bcrypt.hash("Welcome@123", 12);

   // Create user and student/faculty records
   ```

5. **Error Handling**
   - Catches validation errors per row
   - Collects failures without stopping process
   - Returns detailed error messages
   - Cleans up temporary file

### Frontend Flow

```jsx
// 1. User selects file
<input
  type="file"
  accept=".xlsx,.xls,.csv"
  onChange={(e) => setFile(e.target.files[0])}
/>;

// 2. Create FormData
const formData = new FormData();
formData.append("file", file);

// 3. API call with Axios
const response = await api.post("/admin/students/bulk-upload", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});

// 4. Display results (success count + failed rows)
```

---

## Validation Rules

### Common Validations

✅ **File Type:** Only .xlsx, .xls, .csv allowed
✅ **File Size:** Max 15 MB
✅ **Required Fields:** All fields must be present (non-empty)
✅ **Email Format:** Basic validation
✅ **Unique Check:** Email must be unique across Users
✅ **Unique Check (Students):** rollNo must be unique
✅ **Unique Check (Faculty):** employeeId must be unique

### Error Responses

| Reason                 | Status      | Action                                |
| ---------------------- | ----------- | ------------------------------------- |
| No file uploaded       | 400         | Ask user to select file               |
| Invalid file type      | 400         | Accept only Excel files               |
| Missing required field | Row skipped | User sees "Missing required field(s)" |
| Duplicate email        | Row skipped | User sees "Duplicate email"           |
| Duplicate roll number  | Row skipped | User sees "Duplicate rollNo"          |
| Database error         | Row skipped | User sees error message               |

---

## Testing & Sample Data

### Generate Sample Files

```bash
cd backend
node ../docs/generate-samples.js
```

This creates:

- `docs/sample_students_bulk_upload.xlsx` (2 test students)
- `docs/sample_faculty_bulk_upload.xlsx` (2 test faculty)

### Manual Testing Steps

1. **Start Backend & Frontend**

   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

2. **Login as Admin**
   - Email: admin credentials
   - Access: http://localhost:5173/admin/dashboard

3. **Navigate to Bulk Upload**
   - Admin Dashboard → Sidebar → "Bulk Upload Students"
   - Or: http://localhost:5173/admin/bulk-upload-students

4. **Upload File**
   - Select sample Excel file
   - Click "Upload"
   - Review results (success/failed counts)

5. **Verify in Database**
   - Check MongoDB for new Student/User records
   - Verify username was generated
   - Verify password was hashed (never plaintext)

---

## User Flow After Bulk Upload

### Step 1: Bulk Enrollment (Admin)

```
Admin uploads Excel file
↓
Backend creates accounts with:
  - Email ✓
  - Auto-generated username ✓
  - Hashed password (Welcome@123) ✓
↓
Response: "10 students enrolled successfully"
```

### Step 2: Student Login

```
Student receives credentials:
  - Email: john.doe@example.com
  - Username: john.doe (auto-generated)
  - Password: Welcome@123
↓
Student logs in
↓
Redirected to Profile Completion
```

### Step 3: Profile Completion (Student)

```
Student updates their profile:
  - Phone number
  - Address
  - Photo upload
  - Signature upload
  - Personal details
↓
Profile marked as complete
```

---

## Database Schema Changes

### User Model (Updated)

```javascript
{
  username: String,           // NEW - auto-generated, unique, sparse
  email: String,              // Already exists
  passwordHash: String,       // Already exists (hashed with bcrypt)
  role: 'student' | 'faculty',
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Student Model (No changes)

```javascript
{
  userId: ObjectId,          // Ref to User
  enrollmentNo: String,      // rollNo from Excel
  firstName: String,
  lastName: String,
  branch: String,
  currentSemester: Number,
  ...
}
```

---

## Code Examples

### Backend - bulkUploadStudents Controller

```javascript
exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    // Read Excel file
    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const results = { success: [], failed: [] };

    // Process each row
    for (const [idx, row] of rows.entries()) {
      try {
        // Extract fields (case-insensitive alternatives supported)
        const rollNo = String(row.rollNo || row.RollNo || "").trim();
        const fullName = String(
          row.fullName || row.FullName || row.name || "",
        ).trim();
        const email = String(row.email || row.Email || "")
          .trim()
          .toLowerCase();
        const branch = String(row.branch || row.Branch || "").trim();
        const semester = row.semester || row.Sem || row.Semester || "";

        // Validate required fields
        if (!rollNo || !fullName || !email || !branch || !semester) {
          results.failed.push({
            row: idx + 2,
            reason: "Missing required field(s)",
            data: row,
          });
          continue;
        }

        // Check for duplicates
        const dupEmail = await User.findOne({ email });
        const dupRoll = await Student.findOne({ enrollmentNo: rollNo });

        if (dupEmail) {
          results.failed.push({
            row: idx + 2,
            reason: "Duplicate email",
            data: { email },
          });
          continue;
        }
        if (dupRoll) {
          results.failed.push({
            row: idx + 2,
            reason: "Duplicate rollNo",
            data: { rollNo },
          });
          continue;
        }

        // Split full name
        const parts = fullName.split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(" ") || "";

        // Generate unique username
        const base = email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9\.]/g, "");
        let username = base;
        let i = 0;
        while (await User.findOne({ username })) {
          i += 1;
          username = `${base}${i}`;
        }

        // Hash password
        const defaultPassword = "Welcome@123";
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        // Create user and student
        const user = await User.create({
          email,
          passwordHash,
          role: "student",
          username,
        });
        const student = await Student.create({
          userId: user._id,
          enrollmentNo: rollNo,
          firstName,
          lastName,
          branch,
          currentSemester: Number(semester),
        });

        results.success.push({
          row: idx + 2,
          userId: user._id,
          studentId: student._id,
          email,
          rollNo,
        });
      } catch (errRow) {
        results.failed.push({
          row: idx + 2,
          reason: errRow.message,
          data: row,
        });
      }
    }

    // Clean up temporary file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {}

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
```

### Frontend - React Component

```jsx
import React, { useState } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function BulkUploadStudents() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const { data } = await api.post("/admin/students/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data.data);
      toast.success(`Uploaded: ${data.data.success.length} students`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Bulk Upload Students</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Excel File
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full"
          />
        </div>
        <button
          disabled={loading}
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Upload Results</h3>
          <p className="text-green-600">✓ Success: {result.success.length}</p>
          <p className="text-red-600">✗ Failed: {result.failed.length}</p>

          {result.failed.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-medium">
                Failed Rows
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {result.failed.map((f, i) => (
                  <li key={i} className="text-red-600">
                    Row {f.row}: {f.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Security Considerations

### ✅ What We Do

- **Password Hashing:** Using bcrypt (salt rounds: 12)
- **Username Generation:** Auto-generated, cannot be manually set
- **File Validation:** Only Excel files accepted
- **File Cleanup:** Temporary files deleted after processing
- **Role-Based Access:** Only admins can bulk upload
- **Unique Constraints:** Email, rollNo, employeeId all unique

### ⚠️ Important Notes

- Default password `Welcome@123` must be changed by user on first login
- Users should implement password change on first login screen
- Excel files should not be stored permanently (they're deleted)
- Consider adding file upload logs for audit trail

---

## Troubleshooting

### Issue: "EADDRINUSE: port 5000"

**Solution:** Kill process using port 5000

```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
npm run dev
```

### Issue: "xlsx module not found"

**Solution:** Install dependencies

```bash
cd backend
npm install
```

### Issue: "Duplicate email error for all rows"

**Reason:** Same email used multiple times in Excel
**Solution:** Ensure all emails are unique in the file

### Issue: "Missing required field(s)"

**Reason:** One or more columns are missing or empty
**Solution:** Verify Excel has all required columns with no empty cells

---

## File Locations

- 📁 Frontend: `frontend/src/pages/admin/BulkUploadStudents.jsx`
- 📁 Backend Controller: `backend/src/controllers/adminController.js` (lines 252+)
- 📁 Backend Middleware: `backend/src/middleware/excelUpload.js`
- 📁 Routes: `backend/src/routes/admin.js`
- 📁 Sample Generator: `docs/generate-samples.js`
- 📁 Sample Files: `docs/sample_students_bulk_upload.xlsx`

---

## Next Steps

1. ✅ Generate sample Excel files: `node docs/generate-samples.js`
2. ✅ Start backend: `npm run dev` (from backend)
3. ✅ Start frontend: `npm run dev` (from frontend)
4. ✅ Test with sample files
5. ✅ Deploy to production

---

## Support

For issues or feature requests, check:

- Server logs: `backend/server.js` output
- Browser console: F12 → Console tab
- MongoDB logs: Check database connection
