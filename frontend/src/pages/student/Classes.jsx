import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { CalendarDays } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentClasses() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/class-schedule').then(r => {
      setSchedule(r.data.data.schedule);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const grouped = {};
  DAYS.forEach(d => grouped[d] = []);
  (schedule?.timetable || []).forEach(t => {
    if (grouped[t.day]) grouped[t.day].push(t);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Classes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Weekly timetable
          {schedule && <span> · {schedule.branch} Sem {schedule.semester} Sec {schedule.section} · {schedule.session}</span>}
        </p>
      </div>

      {!schedule ? (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No class schedule available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map(day => {
            const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
            const isToday = day === today;
            return (
              <div key={day} className={`card ${isToday ? 'ring-2 ring-primary-500' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{day}</h3>
                  {isToday && <span className="badge-indigo text-xs">Today</span>}
                </div>
                {grouped[day].length === 0 ? (
                  <p className="text-slate-400 text-sm py-2">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {grouped[day].sort((a, b) => a.slot.localeCompare(b.slot)).map((t, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">{t.subjectId?.name || 'Subject'}</p>
                          <span className="text-xs text-primary-600 font-medium">{t.slot}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {t.subjectId?.code} · Prof. {t.facultyId?.firstName} {t.facultyId?.lastName} · {t.room}
                        </p>
                      </div>
                    ))}
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
