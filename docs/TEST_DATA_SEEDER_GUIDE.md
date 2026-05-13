# Test Data Seeding Guide

## Overview

The **Test Data Seeder** is a temporary feature that creates 10 dummy student and 10 dummy faculty accounts in one click for quick testing and development purposes.

⚠️ **IMPORTANT**: This feature should be removed before deploying to production.

---

## Access the Feature

1. **Login as Admin** to http://localhost:5173/admin/dashboard
2. **Sidebar Menu** → Look for "🧪 Seed Test Data" (at the bottom)
3. **Or Direct URL**: http://localhost:5173/admin/seed-test-data

---

## What Gets Created

### 10 Student Accounts with Realistic Indian Names
```
Email Pattern: rahul.sharma@college.edu, priya.verma@college.edu, etc.
Username Pattern: rahul.sharma, priya.verma, etc.
Password (all): Welcome@123
```

**Students Generated**:
1. Rahul Sharma (rahul.sharma@college.edu)
2. Priya Verma (priya.verma@college.edu)
3. Arjun Kumar (arjun.kumar@college.edu)
4. Isha Patel (isha.patel@college.edu)
5. Aditya Singh (aditya.singh@college.edu)
6. Sneha Gupta (sneha.gupta@college.edu)
7. Vikram Reddy (vikram.reddy@college.edu)
8. Anjali Desai (anjali.desai@college.edu)
9. Rohan Nair (rohan.nair@college.edu)
10. Divya Iyer (divya.iyer@college.edu)

**Fields Generated**:
- rollNo: TS0001 → TS0010
- fullName: Rahul Sharma, Priya Verma, etc.
- branch: Cycles through Computer Science, Electrical Engineering, Mechanical Engineering, Civil Engineering, Electronics & Communication
- semester: Cycles through 1-8
- admissionYear: 2023
- session: 2024-25

### 10 Faculty Accounts with Realistic Indian Names
```
Email Pattern: amit.sir@college.edu, neha.mam@college.edu, etc.
Username Pattern: amit.mishra, neha.bhat, etc.
Password (all): Welcome@123
```

**Faculty Generated**:
1. Dr. Amit Mishra (amit.sir@college.edu)
2. Dr. Neha Bhat (neha.mam@college.edu)
3. Prof. Rajesh Joshi (rajesh.sir@college.edu)
4. Dr. Priyanka Rao (priyanka.mam@college.edu)
5. Prof. Sanjay Chopra (sanjay.sir@college.edu)
6. Dr. Meera Menon (meera.mam@college.edu)
7. Prof. Ashok Bansal (ashok.sir@college.edu)
8. Dr. Kavya Sharma (kavya.mam@college.edu)
9. Prof. Nitin Saxena (nitin.sir@college.edu)
10. Dr. Shreya Das (shreya.mam@college.edu)

**Fields Generated**:
- employeeId: EMPL00001 → EMPL00010
- fullName: Realistic Indian names
- department: Cycles through Computer Science, Mathematics, Physics, Chemistry, Electrical Engineering
- designation: Cycles through Professor, Associate Professor, Assistant Professor, Lecturer

---

## How to Use

### Step 1: Access Seeder
Navigate to Admin Dashboard → "🧪 Seed Test Data" menu

### Step 2: Click "Create Test Data"
Button will show progress: "Creating..." while processing

### Step 3: Review Results
Once complete, you'll see:
- ✅ Total accounts created
- ⚠️ Skipped accounts (if they already exist)
- 📋 List of all test accounts with credentials

### Step 4: Copy Credentials
Click the **Copy** button (📋) next to any credential to copy to clipboard

### Step 5: Test Login
1. Go to Login page: http://localhost:5173/login
2. Paste any student/faculty email
3. Password: `Welcome@123`
4. Login and test profile completion workflow

---

## Test Accounts Reference

### Student #1 (Rahul Sharma)
```
Email:    rahul.sharma@college.edu
Username: rahul.sharma
Password: Welcome@123
Roll No:  TS0001
Branch:   Computer Science
Semester: 1
```

### Student #2 (Priya Verma)
```
Email:    priya.verma@college.edu
Username: priya.verma
Password: Welcome@123
Roll No:  TS0002
Branch:   Electrical Engineering
Semester: 2
```

### Faculty #1 (Dr. Amit Mishra)
```
Email:       amit.sir@college.edu
Username:    amit.mishra
Password:    Welcome@123
Employee ID: EMPL00001
Department:  Computer Science
Designation: Professor
```

### Faculty #2 (Dr. Neha Bhat)
```
Email:       neha.mam@college.edu
Username:    neha.bhat
Password:    Welcome@123
Employee ID: EMPL00002
Department:  Mathematics
Designation: Associate Professor
```

(and similarly for others #3 through #10)

---

## Backend API

**Endpoint**: `POST /api/admin/seed-test-data`

**Authorization**: Admin only (requires bearer token)

**Response**:
```json
{
  "success": true,
  "message": "Test data seeded successfully",
  "data": {
    "studentsCreated": 10,
    "facultyCreated": 10,
    "studentsSkipped": 0,
    "facultySkipped": 0,
    "errors": [],
    "testAccounts": {
      "students": [
        { "email": "student1@opensis.com", "username": "teststudent1", "password": "Welcome@123" },
        ...
      ],
      "faculty": [
        { "email": "faculty1@opensis.com", "username": "testfaculty1", "password": "Welcome@123" },
        ...
      ]
    }
  }
}
```

---

## Files Involved

### Backend
- 📄 `backend/src/utils/seedTestData.js` - Seed data generator function
- 📄 `backend/src/controllers/adminController.js` - seedTestData() handler
- 📄 `backend/src/routes/admin.js` - POST /admin/seed-test-data route

### Frontend
- 📄 `frontend/src/pages/admin/SeedTestData.jsx` - React UI component
- 📄 `frontend/src/App.jsx` - Route and navigation added

---

## Testing Workflow

### 1. Generate Test Data
```
Admin Dashboard → Seed Test Data → Click "Create Test Data"
```
This creates 10 students (Rahul, Priya, Arjun, etc.) and 10 faculty members (Dr. Amit, Dr. Neha, Prof. Rajesh, etc.)

### 2. Test Student Login
```
Login → email: rahul.sharma@college.edu → password: Welcome@123
→ Complete profile (phone, address, photo, signature, personal details)
```

### 3. Test Faculty Login
```
Login → email: amit.sir@college.edu → password: Welcome@123
→ Complete profile
```

### 4. Test Bulk Upload
```
Admin Dashboard → Bulk Upload Students → Upload sample Excel file
```

### 5. Test Login with Bulk-Uploaded User
```
Login with email from Excel file
```

---

## Important Notes

### ✅ What This Does Well
- Creates realistic test data quickly
- All accounts are fully functional and can log in
- Passwords are properly hashed with bcrypt
- Supports testing login, profile completion, and bulk upload workflows
- Easy to reset by creating test data again (skips duplicates)

### ⚠️ Limitations
- Only creates default test data (cannot customize)
- Skips accounts that already exist (won't overwrite)
- To reset: Delete test accounts manually from MongoDB and run again

### 🚀 Removing in Production
**Before deploying to production:**

1. Delete these files:
   - `backend/src/utils/seedTestData.js`
   - `frontend/src/pages/admin/SeedTestData.jsx`

2. Remove from `backend/src/controllers/adminController.js`:
   ```javascript
   exports.seedTestData = async (req, res) => { ... }
   ```

3. Remove from `backend/src/routes/admin.js`:
   ```javascript
   router.post('/seed-test-data', authorize('admin'), ctrl.seedTestData);
   ```

4. Remove from `frontend/src/App.jsx`:
   - Import statement
   - Route
   - Navigation item

---

## Troubleshooting

### Issue: "Test data creation failed"
**Solution**: Check MongoDB connection and error message

### Issue: "Accounts already exist"
**Solution**: This is normal - seeder skips duplicates. Accounts are being counted but not recreated.

### Issue: Cannot login with test account
**Possible Causes**:
1. Wrong password (use `Welcome@123`)
2. Account not created (check "Failed" section)
3. Email doesn't exist yet (create test data first)

### Issue: Test data not showing in Admin dashboard
**Solution**: Refresh the page or navigate to Students/Faculty list

---

## Quick Commands

### View all test students (via MongoDB)
```javascript
// By roll number
db.students.find({ enrollmentNo: /^TS[0-9]/ })

// By name
db.students.find({ firstName: { $in: ['Rahul', 'Priya', 'Arjun', 'Isha', 'Aditya', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Divya'] } })
```

### View all test faculty
```javascript
// By employee ID
db.faculties.find({ employeeId: /^EMPL/ })

// By name
db.faculties.find({ firstName: { $in: ['Amit', 'Neha', 'Rajesh', 'Priyanka', 'Sanjay', 'Meera', 'Ashok', 'Kavya', 'Nitin', 'Shreya'] } })
```

### View test users
```javascript
// All test students
db.users.find({ email: /@college.edu/ })

// Specific student
db.users.find({ email: 'rahul.sharma@college.edu' })
```

### Delete test students
```javascript
db.students.deleteMany({ enrollmentNo: /^TS/ })
db.users.deleteMany({ email: { $in: ['rahul.sharma@college.edu', 'priya.verma@college.edu', 'arjun.kumar@college.edu', 'isha.patel@college.edu', 'aditya.singh@college.edu', 'sneha.gupta@college.edu', 'vikram.reddy@college.edu', 'anjali.desai@college.edu', 'rohan.nair@college.edu', 'divya.iyer@college.edu'] } })
```

### Delete test faculty
```javascript
db.faculties.deleteMany({ employeeId: /^EMPL/ })
db.users.deleteMany({ email: { $in: ['amit.sir@college.edu', 'neha.mam@college.edu', 'rajesh.sir@college.edu', 'priyanka.mam@college.edu', 'sanjay.sir@college.edu', 'meera.mam@college.edu', 'ashok.sir@college.edu', 'kavya.mam@college.edu', 'nitin.sir@college.edu', 'shreya.mam@college.edu'] } })
```

---

## Next Steps

1. ✅ Create test data
2. ✅ Test student login & profile completion
3. ✅ Test faculty login & profile completion
4. ✅ Test bulk upload with Excel files
5. ✅ Verify login with bulk-uploaded users
6. 🗑️ Remove seeding feature before production deployment
