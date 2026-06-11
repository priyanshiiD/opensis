import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, GraduationCap, Users, ShieldCheck, ChevronRight, AlertCircle, Globe, Award, Landmark, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(() => localStorage.getItem('erp_last_role') || 'student');
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '', login: '' });

  useEffect(() => {
    if (!user) return;
    const redirects = { admin: '/admin/dashboard', student: '/student/dashboard', faculty: '/faculty/dashboard' };
    navigate(redirects[user.role] || '/', { replace: true });
  }, [user, navigate]);

  // Email validation regex - college/student email format (including .edu, .ac.in, .in, .com, etc.)
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Validate form before submission
  const validateForm = () => {
    const newErrors = { email: '', password: '', login: '' };

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(form.email)) {
      newErrors.email = 'Enter a valid college email (e.g. name@college.edu)';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  // Clear field-specific error when user starts typing
  const handleEmailChange = (e) => {
    setForm(f => ({ ...f, email: e.target.value }));
    if (errors.email) setErrors(e => ({ ...e, email: '' }));
  };

  const handlePasswordChange = (e) => {
    setForm(f => ({ ...f, password: e.target.value }));
    if (errors.password) setErrors(e => ({ ...e, password: '' }));
  };

  // Reset form when switching roles
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    localStorage.setItem('erp_last_role', newRole);
    // Clear all input fields
    setForm({ email: '', password: '' });
    // Clear all validation and login errors
    setErrors({ email: '', password: '', login: '' });
    // Reset password visibility
    setShow(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) return;

    setLoading(true);
    setErrors(e => ({ ...e, login: '' })); // Clear previous login errors

    try {
      // Send role along with email and password
      const u = await login(form.email, form.password, role);
      localStorage.setItem('erp_last_role', role);
      toast.success(`Welcome back, ${u.profile?.firstName || u.email}!`);
      const redirects = { admin: '/admin/dashboard', student: '/student/dashboard', faculty: '/faculty/dashboard' };
      navigate(redirects[u.role] || '/', { replace: true });
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';

      // Map error messages based on specific backend responses
      let displayMessage = message;

      // Check for specific error cases in priority order
      if (message.includes('User not found')) {
        displayMessage = 'User not found. Please contact admin';
      } else if (message.includes('Incorrect password')) {
        displayMessage = 'Incorrect password';
      } else if (message.includes('deactivated')) {
        displayMessage = 'Your account has been deactivated. Please contact admin';
      } else if (message.includes('not authorized') || message.includes('not enrolled')) {
        displayMessage = 'You are not authorized. Contact admin';
      }

      setErrors(e => ({ ...e, login: displayMessage }));
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: GraduationCap },
    { id: 'faculty', label: 'Faculty', icon: Users },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen flex w-full bg-slate-100 font-sans selection:bg-sgsits-blue-900/30">
      {/* LEFT SIDE - Brand & Visuals */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0b0f19] overflow-hidden flex-col justify-between p-12 shadow-2xl border-r border-slate-900">
        {/* Tech Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Brand Background Glows */}
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-sgsits-blue-900/25 blur-[120px] pointer-events-none" />
        <div className="absolute top-[30%] right-[-10%] w-[60%] h-[60%] rounded-full bg-sgsits-gold-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] left-[20%] w-[70%] h-[70%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-sgsits-gold-500/20 p-1">
            <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white tracking-tight leading-none">SGSITS INDORE</span>
            <span className="text-[10px] font-bold text-sgsits-gold-500 tracking-wider mt-1">ESTD. 1952 • AUTONOMOUS</span>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="relative z-10 max-w-lg my-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sgsits-gold-500/10 border border-sgsits-gold-500/30 text-sgsits-gold-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Award className="w-3.5 h-3.5" /> Affiliated to RGPV Bhopal & DAVV Indore
          </div>

          <span className="text-sgsits-gold-500 font-extrabold text-xs tracking-widest uppercase mb-2 block">
            Shri Govindram Seksaria Institute of Technology and Science
          </span>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
            SGSITS Indore
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Access the central academic and administrative portal. Empowering student education, research guidance, and administrative excellence since 1952.
          </p>

          {/* Motto Showcase */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 mb-6 mt-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sgsits-gold-500/5 rounded-full blur-xl pointer-events-none" />
            <span className="block text-[10px] font-bold uppercase tracking-widest text-sgsits-gold-500 mb-2">INSTITUTE MOTTO</span>
            <span className="block text-2xl font-semibold text-white tracking-wide mb-2 font-serif font-semibold">"आचारः प्रथमो धर्मः"</span>
            <span className="block text-xs text-slate-400 italic">"Right conduct is the first and highest duty"</span>
          </div>

          {/* Features checkmark list */}
          <div className="space-y-4 border-t border-white/10 pt-6 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-sgsits-gold-500" />
              <p className="text-sm font-semibold text-slate-300">Secure Single Sign-on for Students & Faculty</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-sgsits-gold-500" />
              <p className="text-sm font-semibold text-slate-300">Integrated Course Registration & Grading System</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-sgsits-gold-500" />
              <p className="text-sm font-semibold text-slate-300">Unified Academic & Examinations Dashboard</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-slate-400 text-xs flex items-center gap-4 border-t border-white/5 pt-6">
          <span>© {new Date().getFullYear()} SGSITS Indore. All rights reserved.</span>
          <span className="text-slate-600">•</span>
          <a href="https://www.sgsits.ac.in" target="_blank" rel="noopener noreferrer" className="hover:text-sgsits-gold-400 transition-colors flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> sgsits.ac.in
          </a>
        </div>
      </div>

      {/* RIGHT SIDE - Form inside elevated visual card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden bg-slate-100/70">
        {/* Glowing visual blobs for premium depth */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-sgsits-blue-100/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-sgsits-gold-100/20 rounded-full blur-[100px] pointer-events-none" />

        {/* Mobile Header (Hidden on large screens) */}
        <div className="absolute top-8 left-8 flex items-center gap-3 lg:hidden">
          <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-9 h-9 object-contain" />
          <div className="flex flex-col">
            <span className="text-sm font-black text-sgsits-blue-900 tracking-tight leading-none">SGSITS INDORE</span>
            <span className="text-[8px] font-bold text-sgsits-gold-600 tracking-wider mt-0.5">ESTD. 1952</span>
          </div>
        </div>

        {/* Elevated Form Card */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-sgsits-blue-900/5 border border-slate-200/50 p-8 md:p-10 relative z-10">
          {/* Logo and Institution Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center border border-sgsits-gold-500/20 p-1 mb-4">
              <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h2 className="text-xl font-black text-sgsits-blue-900 tracking-tight leading-none text-center">SGSITS INDORE</h2>
            <span className="text-[9px] font-extrabold text-sgsits-gold-600 tracking-widest uppercase mt-2 text-center">ERP PORTAL LOGIN</span>
          </div>

          <div className="mb-6 text-center">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Welcome Back</h3>
            <p className="text-slate-400 text-xs">Please sign in to access your administrative workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role Selection Tabs - Pill Segmented Layout */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 tracking-wider uppercase">Select Workspace Role</label>
              <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1 border border-slate-200/50 w-full">
                {roles.map((r) => {
                  const isActive = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleChange(r.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 ${isActive
                        ? 'bg-white text-sgsits-blue-900 shadow-md border border-slate-200/30 scale-[1.01]'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/20'
                        }`}
                    >
                      <r.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-sgsits-gold-600' : 'text-slate-400'}`} />
                      <span className="tracking-tight">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Login Error Alert */}
            {errors.login && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-700">{errors.login}</p>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wider uppercase">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 border rounded-xl text-sm focus:outline-none focus:ring-4 focus:bg-white transition-all shadow-sm placeholder-slate-400 ${errors.email
                      ? 'border-red-300 focus:ring-red-500/10 focus:border-red-500'
                      : 'border-slate-200 focus:ring-sgsits-blue-950/10 focus:border-sgsits-blue-900'
                      }`}
                    placeholder="name@college.edu"
                    value={form.email}
                    onChange={handleEmailChange}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-semibold text-red-600 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 tracking-wider uppercase">Password</label>
                  <Link to="/forgot-password" className="text-xs font-bold text-sgsits-blue-900 hover:text-sgsits-gold-600 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={show ? 'text' : 'password'}
                    className={`w-full pl-10 pr-11 py-3 bg-slate-50/50 border rounded-xl text-sm focus:outline-none focus:ring-4 focus:bg-white transition-all shadow-sm placeholder-slate-400 ${errors.password
                      ? 'border-red-300 focus:ring-red-500/10 focus:border-red-500'
                      : 'border-slate-200 focus:ring-sgsits-blue-950/10 focus:border-sgsits-blue-900'
                      }`}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handlePasswordChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-semibold text-red-600 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.password}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sgsits-blue-900 hover:bg-sgsits-blue-800 active:bg-sgsits-blue-950 text-white rounded-xl py-3.5 px-4 font-bold text-sm shadow-md shadow-sgsits-blue-900/15 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group border border-sgsits-gold-500/10 hover:border-sgsits-gold-500/30"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In Securely
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} SGSITS Indore. Managed by IT Cell.
          </p>
        </div>
      </div>
    </div>
  );
}
