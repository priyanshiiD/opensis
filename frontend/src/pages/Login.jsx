import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Eye, EyeOff, UserCircle, Briefcase, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-fill demo credentials when role changes
  useEffect(() => {
    if (role === 'admin') setForm({ email: 'admin@college.edu', password: 'Admin@123' });
    if (role === 'faculty') setForm({ email: 'prof.sharma@college.edu', password: 'Faculty@123' });
    if (role === 'student') setForm({ email: 'alice@student.college.edu', password: 'Student@123' });
  }, [role]);

  if (user) {
    const redirects = { admin: '/admin/dashboard', student: '/student/dashboard', faculty: '/faculty/dashboard' };
    navigate(redirects[user.role] || '/', { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.profile?.firstName || u.email}!`);
      const redirects = { admin: '/admin/dashboard', student: '/student/dashboard', faculty: '/faculty/dashboard' };
      navigate(redirects[u.role] || '/', { replace: true });
    } catch {
      // error toast handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: UserCircle, color: 'text-sky-500' },
    { id: 'faculty', label: 'Faculty', icon: Briefcase, color: 'text-emerald-500' },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-primary-500' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-200 px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/20 transform hover:scale-105 transition-transform">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">College ERP</h1>
          <p className="text-slate-500 mt-2 text-sm">Welcome back! Please enter your details.</p>
        </div>

        <div className="card border-0 shadow-xl shadow-slate-200/50">
          <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl mb-6">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  role === r.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <r.icon className={`w-5 h-5 ${role === r.id ? r.color : 'text-slate-400'}`} />
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.edu"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2 pt-1 pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-primary-600 border-slate-300 focus:ring-primary-500" />
                <span className="text-xs text-slate-600 font-medium">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          © {new Date().getFullYear()} Modern College ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
