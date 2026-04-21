import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { ClipboardList, Users, Check, X, Save, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [pastRecords, setPastRecords] = useState([]);
  const [tab, setTab] = useState('mark'); // 'mark' | 'history'
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects));
  }, []);

  useEffect(() => {
    if (selectedSubject && tab === 'history') {
      api.get(`/faculty/attendance?subjectId=${selectedSubject}`).then(r => setPastRecords(r.data.data.records));
    }
  }, [selectedSubject, tab]);

  const loadStudents = async () => {
    if (!selectedSubject) return toast.error('Select a subject first');
    const sub = subjects.find(s => s._id === selectedSubject);
    if (!sub) return;
    try {
      // Get students of this subject's branch/semester via admin endpoint won't work, 
      // so we use a workaround — the attendance API will accept any student list
      const { data } = await api.get(`/faculty/attendance?subjectId=${selectedSubject}`);
      // Extract unique students from past attendance, or use empty list for first time
      const pastStudents = new Set();
      (data.data.records || []).forEach(r => {
        (r.records || []).forEach(rec => {
          if (rec.studentId) pastStudents.add(JSON.stringify({ _id: rec.studentId._id || rec.studentId, name: rec.studentId.firstName ? `${rec.studentId.firstName} ${rec.studentId.lastName}` : rec.studentId }));
        });
      });

      // For now, we'll show a simplified approach — faculty enters student records
      // In production, this would fetch from admin/students endpoint with filters
      const uniqueStudents = Array.from(pastStudents).map(s => JSON.parse(s));
      if (uniqueStudents.length > 0) {
        setStudents(uniqueStudents);
        setRecords(uniqueStudents.map(s => ({ studentId: s._id, status: 'present' })));
      } else {
        toast('No students found in past attendance. Mark attendance with student IDs.', { icon: 'ℹ️' });
        setStudents([]);
        setRecords([]);
      }
    } catch {
      toast.error('Failed to load data');
    }
  };

  const toggleStatus = (idx) => {
    setRecords(prev => prev.map((r, i) => i === idx ? { ...r, status: r.status === 'present' ? 'absent' : 'present' } : r));
  };

  const markAll = (status) => {
    setRecords(prev => prev.map(r => ({ ...r, status })));
  };

  const handleSubmit = async () => {
    if (!selectedSubject || !date || records.length === 0) return toast.error('Fill all fields');
    setSubmitting(true);
    const sub = subjects.find(s => s._id === selectedSubject);
    try {
      await api.post('/faculty/attendance', {
        subjectId: selectedSubject,
        date,
        semester: sub?.semester,
        branch: sub?.branch,
        section: 'A',
        records,
      });
      toast.success('Attendance marked successfully');
    } catch {
      toast.error('Failed to mark attendance');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Mark and view attendance records</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('mark')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'mark' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Mark Attendance</button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>History</button>
      </div>

      {/* Subject & Date Selector */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          {tab === 'mark' && (
            <>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={loadStudents} className="btn-primary w-full">
                  <Users className="w-4 h-4" /> Load Students
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mark Tab */}
      {tab === 'mark' && students.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Students ({students.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="text-xs btn-secondary">All Present</button>
              <button onClick={() => markAll('absent')} className="text-xs btn-secondary">All Absent</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 text-slate-500 font-medium">#</th>
                  <th className="text-left py-3 text-slate-500 font-medium">Student</th>
                  <th className="text-center py-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s._id} className="border-b border-slate-50">
                    <td className="py-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 text-slate-800 font-medium">{s.name || s._id}</td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => toggleStatus(i)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${records[i]?.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {records[i]?.status === 'present' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {records[i]?.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-slate-500">
              Present: {records.filter(r => r.status === 'present').length} / {records.length}
            </p>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              <Save className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          {pastRecords.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No attendance records found. Select a subject first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 text-slate-500 font-medium">Date</th>
                    <th className="text-left py-3 text-slate-500 font-medium">Subject</th>
                    <th className="text-center py-3 text-slate-500 font-medium">Present</th>
                    <th className="text-center py-3 text-slate-500 font-medium">Absent</th>
                    <th className="text-center py-3 text-slate-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRecords.map(r => (
                    <tr key={r._id} className="border-b border-slate-50">
                      <td className="py-3 text-slate-800">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="py-3 text-slate-600">{r.subjectId?.name || '—'}</td>
                      <td className="py-3 text-center"><span className="badge-green">{r.records?.filter(x => x.status === 'present').length}</span></td>
                      <td className="py-3 text-center"><span className="badge-red">{r.records?.filter(x => x.status === 'absent').length}</span></td>
                      <td className="py-3 text-center text-slate-500">{r.records?.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
