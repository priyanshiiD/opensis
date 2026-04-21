import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { MessageSquare, Send, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentFeedback() {
  const [myFeedback, setMyFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('submit');
  const [form, setForm] = useState({ subjectId: '', facultyId: '', session: '2024-25', semester: 5, ratings: { teaching: 5, content: 5, interaction: 5 }, comments: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/student/feedback').then(r => {
      setMyFeedback(r.data.data.feedback);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subjectId || !form.facultyId) return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.post('/student/feedback', form);
      toast.success('Feedback submitted!');
      setForm({ ...form, subjectId: '', facultyId: '', comments: '', ratings: { teaching: 5, content: 5, interaction: 5 } });
      api.get('/student/feedback').then(r => setMyFeedback(r.data.data.feedback));
    } catch {
      toast.error('Failed to submit');
    }
    setSubmitting(false);
  };

  const RatingInput = ({ label, value, onChange }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${n <= value ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <Star className="w-4 h-4" fill={n <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
        <span className="text-sm text-slate-500 ml-2">{value}/5</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Feedback</h1>
        <p className="text-slate-500 text-sm mt-1">Provide feedback for your subjects and faculty</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('submit')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'submit' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Submit Feedback</button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>My Feedback</button>
      </div>

      {tab === 'submit' && (
        <div className="card max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Subject ID</label>
              <input className="input" required value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} placeholder="Subject ObjectId" />
            </div>
            <div>
              <label className="label">Faculty ID</label>
              <input className="input" required value={form.facultyId} onChange={e => setForm({ ...form, facultyId: e.target.value })} placeholder="Faculty ObjectId" />
            </div>
            <RatingInput label="Teaching Quality" value={form.ratings.teaching} onChange={v => setForm({ ...form, ratings: { ...form.ratings, teaching: v } })} />
            <RatingInput label="Content Quality" value={form.ratings.content} onChange={v => setForm({ ...form, ratings: { ...form.ratings, content: v } })} />
            <RatingInput label="Interaction" value={form.ratings.interaction} onChange={v => setForm({ ...form, ratings: { ...form.ratings, interaction: v } })} />
            <div>
              <label className="label">Comments (optional)</label>
              <textarea className="input min-h-[80px]" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder="Any additional comments..." />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      )}

      {tab === 'history' && (
        myFeedback.length === 0 ? (
          <div className="card text-center py-12">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No feedback submitted yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myFeedback.map(f => (
              <div key={f._id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{f.subjectId?.name || 'Subject'}</h3>
                    <p className="text-xs text-slate-500">{f.subjectId?.code} · Prof. {f.facultyId?.firstName} {f.facultyId?.lastName}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Teaching: {f.ratings?.teaching}/5</span>
                      <span>Content: {f.ratings?.content}/5</span>
                      <span>Interaction: {f.ratings?.interaction}/5</span>
                    </div>
                    {f.comments && <p className="text-sm text-slate-600 mt-2 italic">"{f.comments}"</p>}
                  </div>
                  <span className="text-xs text-slate-400">{new Date(f.submittedAt || f.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
