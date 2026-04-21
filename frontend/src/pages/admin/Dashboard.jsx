import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Users, BookOpen, Bell, GraduationCap, UserCheck, ArrowRight } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, link }) {
  return (
    <Link to={link || '#'} className="card hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? '—'}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3 text-xs text-slate-500 group-hover:text-primary-600">
        View all <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data.data));
    api.get('/admin/notices').then(r => setNotices(r.data.data.notices.slice(0, 5)));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.profile?.firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Here's what's happening in your institution</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Students" value={stats?.students} icon={GraduationCap} color="bg-indigo-500" link="/admin/students" />
        <StatCard title="Faculty Members" value={stats?.faculty} icon={UserCheck} color="bg-emerald-500" link="/admin/faculty" />
        <StatCard title="Subjects" value={stats?.subjects} icon={BookOpen} color="bg-amber-500" link="/admin/subjects" />
        <StatCard title="Notices" value={stats?.notices} icon={Bell} color="bg-rose-500" link="/admin/notices" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Recent Notices</h2>
          <Link to="/admin/notices" className="text-sm text-primary-600 hover:underline">View all →</Link>
        </div>
        {notices.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No notices yet</p>
        ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n._id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                <Bell className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleDateString()} · <span className="capitalize">{n.audience}</span></p>
                </div>
                {n.isPinned && <span className="badge-indigo ml-auto flex-shrink-0">Pinned</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
