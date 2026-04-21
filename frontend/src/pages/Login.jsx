import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Eye, EyeOff, GraduationCap, Users, ShieldCheck, ChevronRight } from 'lucide-react';
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
      // toast is handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: GraduationCap, bg: 'bg-sky-50', text: 'text-sky-600', activeBg: 'bg-sky-600', activeText: 'text-white' },
    { id: 'faculty', label: 'Faculty', icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600', activeBg: 'bg-emerald-600', activeText: 'text-white' },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, bg: 'bg-indigo-50', text: 'text-indigo-600', activeBg: 'bg-primary-600', activeText: 'text-white' },
  ];

  return (
    <div className="min-h-screen flex w-full bg-slate-50 font-sans">
      {/* LEFT SIDE - Brand & Visuals */}
      <div className="hidden lg:flex w-1/2 relative bg-primary-900 overflow-hidden flex-col justify-between p-12">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary-600/30 blur-[100px]" />
          <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-600/20 blur-[120px]" />
          <div className="absolute -bottom-[20%] left-[20%] w-[80%] h-[80%] rounded-full bg-primary-800/50 blur-[120px]" />
        </div>
        
        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">OpenSIS</span>
        </div>
        
        {/* Hero Copy */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            Intelligent Campus Management
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed mb-8">
            Experience the next generation of educational administration. Unified workflows for students, faculty, and administrators in one powerful ecosystem.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-white/70">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-sky-500 border-2 border-primary-900" />
              <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-primary-900" />
              <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-primary-900" />
            </div>
            <span>Trusted by 10,000+ users worldwide</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="relative z-10 text-primary-200 text-sm">
          © {new Date().getFullYear()} OpenSIS. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        {/* Mobile Header (Hidden on large screens) */}
        <div className="absolute top-8 left-8 flex items-center gap-3 lg:hidden">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">OpenSIS</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-10 text-center lg:text-left mt-8 lg:mt-0">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-3">Welcome back</h2>
            <p className="text-slate-500">Please enter your details to sign in to your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Role Selection Tabs */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Select Role</label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => {
                  const isActive = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                        isActive 
                          ? `border-primary-500 ${r.bg} shadow-md shadow-primary-500/10 scale-[1.02]` 
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-xl transition-colors ${isActive ? r.activeBg : r.bg}`}>
                        <r.icon className={`w-5 h-5 ${isActive ? r.activeText : r.text}`} />
                      </div>
                      <span className={`text-xs font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                        {r.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder-slate-400 transition-all shadow-sm"
                  placeholder="your@email.edu"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <Link to="/forgot-password" className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder-slate-400 transition-all shadow-sm pr-11"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded text-primary-600 border-slate-300 focus:ring-primary-500 cursor-pointer" />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Keep me signed in</label>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3.5 px-4 font-bold text-sm shadow-md shadow-primary-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group">
              {loading ? 'Authenticating...' : 'Sign In securely'}
              {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
          
          <p className="mt-8 text-center text-sm text-slate-500 lg:hidden">
            © {new Date().getFullYear()} OpenSIS.
          </p>
        </div>
      </div>
    </div>
  );
}
