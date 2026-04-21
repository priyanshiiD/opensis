import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Save, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyMarks() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [semester, setSemester] = useState('5');
  const [session, setSession] = useState('2024-25');
  const [entries, setEntries] = useState([]);
  const [existingResults, setExistingResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('update');

  useEffect(() => {
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects));
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
    setEntries([...entries, { studentId: '', subjectId: selectedSubject, internalMarks: '', externalMarks: '' }]);
  };

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (entries.length === 0) return toast.error('Add at least one entry');
    const valid = entries.every(e => e.studentId && e.subjectId);
    if (!valid) return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.post('/faculty/marks', {
        semester: Number(semester),
        session,
        entries: entries.map(e => ({
          ...e,
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Update Marks</h1>
        <p className="text-slate-500 text-sm mt-1">Bulk update student marks and results</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('update')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'update' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Update Marks</button>
        <button onClick={() => setTab('view')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>View Results</button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Subject</label>
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

      {/* Update Tab */}
      {tab === 'update' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Mark Entries</h3>
            <button onClick={addEntry} className="btn-secondary text-xs">+ Add Row</button>
          </div>

          {entries.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Click "Add Row" to start entering marks</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 text-slate-500 font-medium">Student ID</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Internal</th>
                      <th className="text-center py-2 text-slate-500 font-medium">External</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2"><input className="input text-xs" value={e.studentId} onChange={ev => updateEntry(i, 'studentId', ev.target.value)} placeholder="Paste student ObjectId" /></td>
                        <td className="py-2"><input type="number" className="input w-20 text-center text-xs mx-auto" value={e.internalMarks} onChange={ev => updateEntry(i, 'internalMarks', ev.target.value)} placeholder="0" /></td>
                        <td className="py-2"><input type="number" className="input w-20 text-center text-xs mx-auto" value={e.externalMarks} onChange={ev => updateEntry(i, 'externalMarks', ev.target.value)} placeholder="0" /></td>
                        <td className="py-2 text-center"><button onClick={() => removeEntry(i)} className="text-red-500 text-xs hover:underline">Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                  <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Submit Marks'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* View Tab */}
      {tab === 'view' && (
        <div className="card">
          {existingResults.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No results found for this semester/session</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 text-slate-500 font-medium">Student</th>
                    <th className="text-center py-3 text-slate-500 font-medium">SGPA</th>
                    <th className="text-center py-3 text-slate-500 font-medium">Status</th>
                    <th className="text-left py-3 text-slate-500 font-medium">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {existingResults.map(r => (
                    <tr key={r._id} className="border-b border-slate-50">
                      <td className="py-3 text-slate-800 font-medium">
                        {r.studentId?.firstName} {r.studentId?.lastName}
                        <br /><span className="text-xs text-slate-400">{r.studentId?.enrollmentNo}</span>
                      </td>
                      <td className="py-3 text-center font-bold text-primary-600">{r.sgpa}</td>
                      <td className="py-3 text-center"><span className={r.status === 'pass' ? 'badge-green' : 'badge-red'}>{r.status?.toUpperCase()}</span></td>
                      <td className="py-3 text-xs text-slate-500">
                        {(r.subjectMarks || []).map(sm => `${sm.subjectId?.code || '?'}: ${sm.totalMarks} (${sm.grade})`).join(' | ')}
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
