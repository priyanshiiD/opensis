import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell, CreditCard, CalendarCheck, ArrowRight } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [fees, setFees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    api.get('/student/notices').then(r => setNotices(r.data.data.notices.slice(0, 3)));
    api.get('/student/fees').then(r => setFees(r.data.data.fees));
    api.get('/student/attendance').then(r => setAttendance(r.data.data.attendance));
    api.get('/student/assignments').then(r => setAssignments(r.data.data.assignments));
  }, []);

  const totalClasses = attendance.reduce((a, s) => a + s.total, 0);
  const presentClasses = attendance.reduce((a, s) => a + s.present, 0);
  const attendancePct = totalClasses ? Math.round((presentClasses / totalClasses) * 100) : 0;
  const unpaidFees = fees.filter(f => f.status === 'pending').length;
  const pendingAssignments = assignments.filter(a => !a.mySubmission).length;

  const stats = [
    { label: 'Attendance', value: `${attendancePct}%`, icon: CalendarCheck, color: attendancePct >= 75 ? 'bg-green-500' : 'bg-red-500', link: '/student/attendance' },
    { label: 'Pending Assignments', value: pendingAssignments, icon: BookOpen, color: 'bg-amber-500', link: '/student/assignments' },
    { label: 'Unpaid Fees', value: unpaidFees, icon: CreditCard, color: 'bg-rose-500', link: '/student/fees' },
    { label: 'Notices', value: notices.length, icon: Bell, color: 'bg-indigo-500', link: '/student/notices' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome, {user?.profile?.firstName}! 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.profile?.branch} · Semester {user?.profile?.currentSemester} · Section {user?.profile?.section}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Recent Notices</h2>
          <Link to="/student/notices" className="text-sm text-primary-600 hover:underline">View all →</Link>
        </div>
        {notices.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No notices</p>
        ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n._id} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
