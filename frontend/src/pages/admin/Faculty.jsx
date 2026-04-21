import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Plus, Search } from 'lucide-react';

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/admin/faculty').then(r => setFaculty(r.data.data.faculty)).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? faculty.filter(f => `${f.firstName} ${f.lastName} ${f.employeeId}`.toLowerCase().includes(search.toLowerCase()))
    : faculty;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Faculty</h1>
          <p className="text-slate-500 text-sm">{faculty.length} members</p>
        </div>
        <Link to="/admin/faculty/enroll" className="btn-primary"><Plus className="w-4 h-4" />Enroll Faculty</Link>
      </div>

      <div className="card mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search name or employee ID" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Employee ID', 'Name', 'Department', 'Designation', 'Subjects', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No faculty found</td></tr>
              ) : (
                filtered.map(f => (
                  <tr key={f._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{f.employeeId}</td>
                    <td className="px-4 py-3 font-medium">{f.firstName} {f.lastName}</td>
                    <td className="px-4 py-3"><span className="badge-indigo">{f.department || '—'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{f.designation || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{f.subjectsTaught?.length || 0} subjects</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/faculty/${f._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
