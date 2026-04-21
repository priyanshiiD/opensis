import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import { Plus, FileText, Upload, Eye, Star, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewSubs, setViewSubs] = useState(null); // assignment id for viewing submissions
  const [submissions, setSubmissions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', subjectId: '', dueDate: '', maxMarks: 20 });
  const fileRef = useRef(null);

  useEffect(() => {
    loadAssignments();
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects));
  }, []);

  const loadAssignments = () => {
    api.get('/faculty/assignments').then(r => setAssignments(r.data.data.assignments));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current?.files[0]) fd.append('file', fileRef.current.files[0]);
      await api.post('/faculty/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Assignment created');
      setShowCreate(false);
      setForm({ title: '', description: '', subjectId: '', dueDate: '', maxMarks: 20 });
      loadAssignments();
    } catch {
      toast.error('Failed to create assignment');
    }
    setCreating(false);
  };

  const loadSubmissions = async (assignmentId) => {
    if (viewSubs === assignmentId) { setViewSubs(null); return; }
    try {
      const { data } = await api.get(`/faculty/assignments/${assignmentId}/submissions`);
      setSubmissions(data.data.submissions || []);
      setViewSubs(assignmentId);
    } catch {
      toast.error('Failed to load submissions');
    }
  };

  const gradeSubmission = async (subId, marks, feedback) => {
    try {
      await api.patch(`/faculty/submissions/${subId}`, { marks: Number(marks), feedback });
      toast.success('Graded!');
      loadSubmissions(viewSubs);
    } catch {
      toast.error('Failed to grade');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage assignments</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Create Assignment</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Assignment title" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." />
            </div>
            <div>
              <label className="label">Subject</label>
              <select className="input" required value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Max Marks</label>
              <input type="number" className="input" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} />
            </div>
            <div>
              <label className="label">Attachment (optional)</label>
              <input type="file" ref={fileRef} className="input" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No assignments created yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => {
            const isOverdue = new Date(a.dueDate) < new Date();
            return (
              <div key={a._id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{a.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{a.subjectId?.code} — {a.subjectId?.name}</p>
                    {a.description && <p className="text-sm text-slate-600 mt-2">{a.description}</p>}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      <span>Max: {a.maxMarks} marks</span>
                      <span>{a.submissions?.length || 0} submissions</span>
                      {isOverdue && <span className="badge-red">Overdue</span>}
                    </div>
                  </div>
                  <button onClick={() => loadSubmissions(a._id)} className="btn-secondary text-xs">
                    <Eye className="w-3 h-3" /> {viewSubs === a._id ? 'Hide' : 'Submissions'}
                  </button>
                </div>

                {/* Submissions panel */}
                {viewSubs === a._id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {submissions.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-3">No submissions yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 text-slate-500 font-medium">Student</th>
                              <th className="text-left py-2 text-slate-500 font-medium">Submitted</th>
                              <th className="text-left py-2 text-slate-500 font-medium">File</th>
                              <th className="text-center py-2 text-slate-500 font-medium">Marks</th>
                              <th className="text-center py-2 text-slate-500 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {submissions.map(s => (
                              <SubmissionRow key={s._id} s={s} maxMarks={a.maxMarks} onGrade={gradeSubmission} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ s, maxMarks, onGrade }) {
  const [marks, setMarks] = useState(s.marks ?? '');
  const [feedback, setFeedback] = useState(s.feedback || '');

  return (
    <tr className="border-b border-slate-50">
      <td className="py-2 text-slate-800">{s.studentId?.firstName} {s.studentId?.lastName}<br /><span className="text-xs text-slate-400">{s.studentId?.enrollmentNo}</span></td>
      <td className="py-2 text-slate-500 text-xs">{new Date(s.submittedAt).toLocaleString()}</td>
      <td className="py-2">{s.fileUrl ? <a href={s.fileUrl} target="_blank" className="text-primary-600 text-xs hover:underline">View File</a> : '—'}</td>
      <td className="py-2 text-center">
        <input type="number" className="input w-16 text-center text-xs" max={maxMarks} value={marks} onChange={e => setMarks(e.target.value)} placeholder="—" />
      </td>
      <td className="py-2 text-center">
        <button onClick={() => onGrade(s._id, marks, feedback)} className="btn-primary text-xs py-1">Grade</button>
      </td>
    </tr>
  );
}
