import React, { useEffect, useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../../api/axios';
import { Calendar, BarChart3, RotateCcw, Send, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentExam() {
  const [tab, setTab] = useState('schedule');
  const [schedules, setSchedules] = useState([]);
  const [results, setResults] = useState([]);
  const [revalForm, setRevalForm] = useState({ subjectId: '', session: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admitCard, setAdmitCard] = useState(null);
  const [loadingAdmit, setLoadingAdmit] = useState(false);
  const admitRef = useRef(null);

  const handlePrintAdmit = useReactToPrint({ contentRef: admitRef });

  const downloadAdmitCard = async () => {
    setLoadingAdmit(true);
    try {
      const { data } = await api.get('/student/admit-card');
      setAdmitCard(data.data.admitCard);
    } catch {
      toast.error('Failed to load admit card');
    }
    setLoadingAdmit(false);
  };

  useEffect(() => {
    Promise.all([
      api.get('/student/exam-schedule').then(r => setSchedules(r.data.data.schedules)),
      api.get('/student/result').then(r => setResults(r.data.data.results)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleRevaluation = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/student/revaluation', revalForm);
      toast.success('Revaluation request submitted');
      setRevalForm({ subjectId: '', session: '', reason: '' });
    } catch {
      toast.error('Failed to submit');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const tabs = [
    { key: 'schedule', label: 'Schedule', icon: Calendar },
    { key: 'admitcard', label: 'Admit Card', icon: Download },
    { key: 'results', label: 'Results', icon: BarChart3 },
    { key: 'revaluation', label: 'Revaluation', icon: RotateCcw },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Exams & Results</h1>
        <p className="text-slate-500 text-sm mt-1">Exam schedules, results, and revaluation requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Schedule Tab */}
      {tab === 'schedule' && (
        schedules.length === 0 ? (
          <div className="card text-center py-12">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No exam schedule available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {schedules.map(s => (
              <div key={s._id} className="card">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-slate-800">{s.examType?.toUpperCase()} Semester Exam</h3>
                  <span className="badge-indigo">{s.session}</span>
                  <span className="badge-blue">{s.branch} Sem {s.semester}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 text-slate-500 font-medium">Subject</th>
                        <th className="text-left py-3 text-slate-500 font-medium">Date</th>
                        <th className="text-left py-3 text-slate-500 font-medium">Time</th>
                        <th className="text-left py-3 text-slate-500 font-medium">Venue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.entries || []).map((e, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-3 text-slate-800 font-medium">{e.subjectId?.name || '—'}<br /><span className="text-xs text-slate-400">{e.subjectId?.code}</span></td>
                          <td className="py-3 text-slate-600">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="py-3 text-slate-600">{e.startTime} — {e.endTime}</td>
                          <td className="py-3"><span className="badge-blue">{e.venue}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Admit Card Tab */}
      {tab === 'admitcard' && (
        <div>
          {!admitCard ? (
            <div className="card text-center py-12">
              <Download className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">Generate your admit card for the upcoming exams</p>
              <button onClick={downloadAdmitCard} disabled={loadingAdmit} className="btn-primary mx-auto">
                <Download className="w-4 h-4" /> {loadingAdmit ? 'Loading...' : 'Generate Admit Card'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={handlePrintAdmit} className="btn-primary"><Printer className="w-4 h-4" /> Print / Download PDF</button>
              </div>
              <div ref={admitRef} className="card max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="text-center border-b border-slate-200 pb-4 mb-4">
                  <h2 className="text-xl font-bold text-slate-800">{admitCard.collegeName}</h2>
                  <p className="text-sm text-slate-500 mt-1">ADMIT CARD — {admitCard.examSchedule?.examType?.toUpperCase()} SEMESTER EXAMINATION</p>
                  <p className="text-xs text-slate-400">Session: {admitCard.examSchedule?.session}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-800">{admitCard.student.name}</span></div>
                  <div><span className="text-slate-500">Enrollment No:</span> <span className="font-medium text-slate-800">{admitCard.student.enrollmentNo}</span></div>
                  <div><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-800">{admitCard.student.branch}</span></div>
                  <div><span className="text-slate-500">Semester:</span> <span className="font-medium text-slate-800">{admitCard.student.semester}</span></div>
                  <div><span className="text-slate-500">Section:</span> <span className="font-medium text-slate-800">{admitCard.student.section}</span></div>
                  <div><span className="text-slate-500">Father's Name:</span> <span className="font-medium text-slate-800">{admitCard.student.fatherName || '—'}</span></div>
                </div>
                <table className="w-full text-sm border border-slate-200 mb-4">
                  <thead><tr className="bg-slate-50"><th className="py-2 px-3 text-left border-b">Subject</th><th className="py-2 px-3 text-left border-b">Date</th><th className="py-2 px-3 text-left border-b">Time</th><th className="py-2 px-3 text-left border-b">Venue</th></tr></thead>
                  <tbody>
                    {(admitCard.examSchedule?.entries || []).map((e, i) => (
                      <tr key={i} className="border-b border-slate-100"><td className="py-2 px-3">{e.subjectId?.name} ({e.subjectId?.code})</td><td className="py-2 px-3">{new Date(e.date).toLocaleDateString()}</td><td className="py-2 px-3">{e.startTime}–{e.endTime}</td><td className="py-2 px-3">{e.venue}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between text-xs text-slate-400 mt-6 pt-4 border-t border-slate-200">
                  <span>Issued: {new Date(admitCard.issuedOn).toLocaleDateString()}</span>
                  <span>Authorized Signature: _______________</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === 'results' && (
        results.length === 0 ? (
          <div className="card text-center py-12">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No results available yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {results.map(r => (
              <div key={r._id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800">Semester {r.semester}</h3>
                    <p className="text-xs text-slate-500">Session: {r.session}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">{r.sgpa}</p>
                    <p className="text-xs text-slate-500">SGPA</p>
                    <span className={`mt-1 inline-block ${r.status === 'pass' ? 'badge-green' : 'badge-red'}`}>{r.status?.toUpperCase()}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-slate-500 font-medium">Subject</th>
                        <th className="text-center py-2 text-slate-500 font-medium">Internal</th>
                        <th className="text-center py-2 text-slate-500 font-medium">External</th>
                        <th className="text-center py-2 text-slate-500 font-medium">Total</th>
                        <th className="text-center py-2 text-slate-500 font-medium">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(r.subjectMarks || []).map((sm, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-2 text-slate-800">{sm.subjectId?.name || '—'}<br /><span className="text-xs text-slate-400">{sm.subjectId?.code}</span></td>
                          <td className="py-2 text-center text-slate-600">{sm.internalMarks ?? '—'}</td>
                          <td className="py-2 text-center text-slate-600">{sm.externalMarks ?? '—'}</td>
                          <td className="py-2 text-center font-medium text-slate-800">{sm.totalMarks ?? '—'}</td>
                          <td className="py-2 text-center">
                            <span className={`${(sm.totalMarks || 0) >= 40 ? 'badge-green' : 'badge-red'}`}>{sm.grade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Revaluation Tab */}
      {tab === 'revaluation' && (
        <div className="card max-w-xl">
          <h3 className="font-semibold text-slate-800 mb-4">Request Revaluation</h3>
          <form onSubmit={handleRevaluation} className="space-y-4">
            <div>
              <label className="label">Subject ID</label>
              <input className="input" required value={revalForm.subjectId} onChange={e => setRevalForm({ ...revalForm, subjectId: e.target.value })} placeholder="Enter subject ID" />
            </div>
            <div>
              <label className="label">Session</label>
              <input className="input" required value={revalForm.session} onChange={e => setRevalForm({ ...revalForm, session: e.target.value })} placeholder="e.g. 2024-25" />
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea className="input min-h-[100px]" required value={revalForm.reason} onChange={e => setRevalForm({ ...revalForm, reason: e.target.value })} placeholder="Explain your reason for revaluation..." />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
