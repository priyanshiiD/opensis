import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (branch) params.set('branch', branch);
      if (semester) params.set('semester', semester);
      const { data } = await api.get(`/admin/students?${params}`);
      setStudents(data.data.students);
      setTotal(data.data.total);
      setPages(data.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, branch, semester]);

  const filtered = search
    ? students.filter(s => `${s.firstName} ${s.lastName} ${s.enrollmentNo}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-500 text-sm">{total} total enrolled</p>
        </div>
        <Link to="/admin/enroll-student" className="btn-primary">
          <Plus className="w-4 h-4" />Enroll Student
        </Link>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search name or enrollment no." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={branch} onChange={e => { setBranch(e.target.value); setPage(1); }}>
            <option value="">All Branches</option>
            <option>IT</option><option>CSE</option><option>ECE</option><option>ME</option><option>CE</option>
          </select>
          <select className="input w-auto" value={semester} onChange={e => { setSemester(e.target.value); setPage(1); }}>
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Enrollment No.', 'Name', 'Branch', 'Semester', 'Section', 'Gender', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No students found</td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.enrollmentNo}</td>
                    <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                    <td className="px-4 py-3">Sem {s.currentSemester}</td>
                    <td className="px-4 py-3">{s.section || '—'}</td>
                    <td className="px-4 py-3 capitalize">{s.gender || '—'}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/students/${s._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === pages} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
