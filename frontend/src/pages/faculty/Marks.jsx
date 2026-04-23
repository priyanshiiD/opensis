import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Save, BarChart3, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyMarks() {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [semester, setSemester] = useState('5');
  const [session, setSession] = useState('2024-25');
  const [entries, setEntries] = useState([]);
  const [existingResults, setExistingResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('update');
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects)),
      api.get('/admin/students?limit=1000').then(r => setStudents(r.data.data.students || [])),
    ]);
  }, []);

  const loadExisting = () => {
    api.get(`/faculty/marks?semester=${semester}&session=${session}`).then(r => {
      setExistingResults(r.data.data.results || []);
    });
  };

  useEffect(() => {
    if (tab === 'view') loadExisting();
  }, [tab, semester, session]);

  const addEntry = () => {
    setEntries([...entries, { studentId: '', internalMarks: '', externalMarks: '' }]);
  };

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (entries.length === 0) return toast.error('Add at least one entry');
    if (!selectedSubject) return toast.error('Select a subject');
    const valid = entries.every(e => e.studentId && (e.internalMarks !== '' || e.externalMarks !== ''));
    if (!valid) return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.post('/faculty/marks', {
        semester: Number(semester),
        session,
        entries: entries.map(e => ({
          studentId: e.studentId,
          subjectId: selectedSubject,
          internalMarks: Number(e.internalMarks) || 0,
          externalMarks: Number(e.externalMarks) || 0,
        })),
      });
      toast.success('Marks updated successfully');
      setEntries([]);
      if (tab === 'view') loadExisting();
    } catch {
      toast.error('Failed to update marks');
    }
    setSubmitting(false);
  };

  const getStudentName = (id) => {
    const s = students.find(st => st._id === id);
    return s ? `${s.firstName} ${s.lastName} (${s.enrollmentNo})` : 'Unknown';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Update Marks</h1>
        <p className="text-slate-500 text-sm mt-1">Upload and manage student marks for your subjects</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('update')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'update' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Upload Marks</button>
        <button onClick={() => setTab('view')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>View Results</button>
      </div>

      {/* Update Tab */}
      {tab === 'update' && (
        <>
          {/* Filters */}
          <div className="card mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Subject *</label>
                <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester</label>
                <input type="number" className="input" value={semester} onChange={e => setSemester(e.target.value)} />
              </div>
              <div>
                <label className="label">Session</label>
                <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2024-25" />
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Mark Entries</h3>
              <button onClick={addEntry} className="btn-secondary text-xs flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Student
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Click "Add Student" to start entering marks</p>
            ) : (
              <>
                <div className="space-y-3">
                  {entries.map((e, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="label text-xs">Student *</label>
                          <select 
                            className="input text-sm"
                            value={e.studentId}
                            onChange={ev => updateEntry(i, 'studentId', ev.target.value)}
                          >
                            <option value="">Select student</option>
                            {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.enrollmentNo})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Internal (40)</label>
                          <input 
                            type="number" 
                            className="input text-sm"
                            value={e.internalMarks}
                            onChange={ev => updateEntry(i, 'internalMarks', ev.target.value)}
                            placeholder="0-40"
                            min="0"
                            max="40"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">External (60)</label>
                          <input 
                            type="number"
                            className="input text-sm"
                            value={e.externalMarks}
                            onChange={ev => updateEntry(i, 'externalMarks', ev.target.value)}
                            placeholder="0-60"
                            min="0"
                            max="60"
                          />
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => removeEntry(i)} className="btn-danger text-xs w-full">
                            <X className="w-4 h-4 inline" /> Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Total: {(Number(e.internalMarks) || 0) + (Number(e.externalMarks) || 0)} / 100
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEntries([])} className="btn-secondary">Clear All</button>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                    <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Submit Marks'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* View Tab */}
      {tab === 'view' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Results Summary</h3>
            <div className="flex gap-2">
              <input 
                type="number"
                className="input text-sm w-24"
                value={semester}
                onChange={e => setSemester(e.target.value)}
                placeholder="Sem"
              />
              <input
                className="input text-sm w-32"
                value={session}
                onChange={e => setSession(e.target.value)}
                placeholder="2024-25"
              />
              <button onClick={loadExisting} className="btn-secondary text-xs">Refresh</button>
            </div>
          </div>
          
          {existingResults.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No results found for this semester/session</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Student</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">SGPA</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Percentage</th>
                    <th className="text-center py-3 px-2 text-slate-600 font-semibold">Status</th>
                    <th className="text-left py-3 px-2 text-slate-600 font-semibold">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {existingResults.map(r => (
                    <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-2 text-slate-800 font-medium">
                        {r.studentId?.firstName} {r.studentId?.lastName}
                        <br /><span className="text-xs text-slate-400">{r.studentId?.enrollmentNo}</span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-primary-600">{r.sgpa || '-'}</td>
                      <td className="py-3 px-2 text-center font-bold text-amber-600">{r.percentage ? r.percentage.toFixed(1) + '%' : '-'}</td>
                      <td className="py-3 px-2 text-center"><span className={r.status === 'pass' ? 'badge-green' : 'badge-red'}>{r.status?.toUpperCase() || 'PENDING'}</span></td>
                      <td className="py-3 px-2 text-xs text-slate-600">
                        {(r.subjectMarks || []).length === 0 ? '—' : (r.subjectMarks || []).map(sm => `${sm.subjectId?.code || '?'}: ${sm.totalMarks || '–'} (${sm.grade || '–'})`).join(' • ')}
                      </td>
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
