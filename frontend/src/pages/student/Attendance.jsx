import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { ClipboardList, TrendingUp, TrendingDown } from 'lucide-react';

export default function StudentAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/attendance').then(r => {
      setAttendance(r.data.data.attendance);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const totalClasses = attendance.reduce((a, s) => a + s.total, 0);
  const totalPresent = attendance.reduce((a, s) => a + s.present, 0);
  const overallPct = totalClasses ? Math.round((totalPresent / totalClasses) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Subject-wise attendance breakdown</p>
      </div>

      {/* Overall */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Overall Attendance</p>
            <p className="text-4xl font-bold text-slate-800 mt-1">{overallPct}%</p>
            <p className="text-xs text-slate-400 mt-1">{totalPresent} / {totalClasses} classes attended</p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${overallPct >= 75 ? 'bg-green-100' : 'bg-red-100'}`}>
            {overallPct >= 75 ? <TrendingUp className="w-8 h-8 text-green-600" /> : <TrendingDown className="w-8 h-8 text-red-600" />}
          </div>
        </div>
        {overallPct < 75 && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600 font-medium">⚠️ Your attendance is below 75%. You may face detention.</p>
          </div>
        )}
      </div>

      {/* Subject-wise */}
      {attendance.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No attendance records yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendance.map(a => {
            const pct = a.total ? Math.round((a.present / a.total) * 100) : 0;
            return (
              <div key={a.subject?._id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{a.subject?.name}</h3>
                    <p className="text-xs text-slate-500">{a.subject?.code}</p>
                  </div>
                  <span className={`text-lg font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                  <div className={`h-2.5 rounded-full transition-all ${pct >= 75 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Present: {a.present}</span>
                  <span>Absent: {a.total - a.present}</span>
                  <span>Total: {a.total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
