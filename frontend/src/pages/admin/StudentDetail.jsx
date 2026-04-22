import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, User, Pencil } from 'lucide-react';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/students/${id}`).then(r => setStudent(r.data.data.student)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!student) return <p className="text-slate-400 text-center py-10">Student not found</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/students" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-slate-800">Student Profile</h1>
        <Link to={`/admin/students/${id}/edit`} className="ml-auto btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" />Edit Details
        </Link>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{student.firstName} {student.lastName}</h2>
            <p className="text-slate-500 text-sm font-mono">{student.enrollmentNo}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="badge-blue">{student.department}</span>
            <span className="badge-indigo">Y{student.year} · {student.semester}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Personal Info</h3>
          <div className="space-y-3">
            <Field label="Gender" value={student.gender} />
            <Field label="Date of Birth" value={student.dob ? new Date(student.dob).toLocaleDateString() : null} />
            <Field label="Phone" value={student.phone} />
            <Field label="Address" value={student.address} />
            <Field label="Father's Name" value={student.fatherName} />
            <Field label="Mother's Name" value={student.motherName} />
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Academic Info</h3>
          <div className="space-y-3">
            <Field label="Department" value={student.department} />
            <Field label="Year" value={student.year ? `Year ${student.year}` : null} />
            <Field label="Semester Period" value={student.semester} />
            <Field label="Section" value={student.section} />
            <Field label="Session" value={student.session} />
            <Field label="Admission Year" value={student.admissionYear} />
            <Field label="Enrolled On" value={new Date(student.createdAt).toLocaleDateString()} />
          </div>
        </div>
      </div>
    </div>
  );
}
