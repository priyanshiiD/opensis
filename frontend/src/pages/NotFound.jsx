import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary-600 mb-2">404</h1>
        <p className="text-xl font-semibold text-slate-800 mb-2">Page Not Found</p>
        <p className="text-slate-500 text-sm mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/login" className="btn-primary">
          <Home className="w-4 h-4" /> Go to Login
        </Link>
      </div>
    </div>
  );
}
