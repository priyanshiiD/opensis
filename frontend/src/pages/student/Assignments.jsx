import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import { FileText, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = () => {
    api.get('/student/assignments').then(r => {
      setAssignments(r.data.data.assignments);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleSubmit = async (assignmentId, file) => {
    if (!file) return toast.error('Select a file first');
    setSubmitting(assignmentId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/student/assignments/${assignmentId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Submitted successfully!');
      loadAssignments();
    } catch {
      toast.error('Failed to submit');
    }
    setSubmitting(null);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Assignments</h1>
        <p className="text-slate-500 text-sm mt-1">View assignments and submit your work</p>
      </div>

      {assignments.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No assignments available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => {
            const isOverdue = new Date(a.dueDate) < new Date();
            const submitted = !!a.mySubmission;
            const graded = a.mySubmission?.marks !== undefined && a.mySubmission?.marks !== null;

            return (
              <div key={a._id} className={`card ${submitted ? 'border-l-4 border-l-green-400' : isOverdue ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-amber-400'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{a.title}</h3>
                      {submitted && graded && <span className="badge-green"><CheckCircle className="w-3 h-3 inline mr-1" />Graded</span>}
                      {submitted && !graded && <span className="badge-blue"><CheckCircle className="w-3 h-3 inline mr-1" />Submitted</span>}
                      {!submitted && isOverdue && <span className="badge-red"><AlertCircle className="w-3 h-3 inline mr-1" />Overdue</span>}
                      {!submitted && !isOverdue && <span className="badge-yellow"><Clock className="w-3 h-3 inline mr-1" />Pending</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{a.subjectId?.code} — {a.subjectId?.name}</p>
                    {a.description && <p className="text-sm text-slate-600 mt-2">{a.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      <span>Max: {a.maxMarks} marks</span>
                      {a.facultyId && <span>By: Prof. {a.facultyId.firstName}</span>}
                    </div>

                    {/* Grading info */}
                    {graded && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-700">Score: {a.mySubmission.marks} / {a.maxMarks}</p>
                        {a.mySubmission.feedback && <p className="text-xs text-green-600 mt-1">Feedback: {a.mySubmission.feedback}</p>}
                      </div>
                    )}
                  </div>

                  {/* Upload Section */}
                  {!submitted ? (
                    <FileUploadButton
                      assignmentId={a._id}
                      onSubmit={handleSubmit}
                      isSubmitting={submitting === a._id}
                    />
                  ) : (
                    <div className="text-xs text-slate-400 text-right">
                      <p>Submitted</p>
                      <p>{new Date(a.mySubmission.submittedAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileUploadButton({ assignmentId, onSubmit, isSubmitting }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <input type="file" ref={fileRef} className="hidden" onChange={e => setFile(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
        <Upload className="w-3 h-3" /> {file ? file.name.slice(0, 15) + '...' : 'Choose File'}
      </button>
      {file && (
        <button onClick={() => onSubmit(assignmentId, file)} disabled={isSubmitting} className="btn-primary text-xs">
          {isSubmitting ? 'Uploading...' : 'Submit'}
        </button>
      )}
    </div>
  );
}
