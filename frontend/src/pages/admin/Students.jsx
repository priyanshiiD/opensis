import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Search, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download } from 'lucide-react';

const SESSION_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const startYear = new Date().getFullYear() - index;
  return `${startYear}-${startYear + 1}`;
});

const BRANCH_OPTIONS = ['CSE', 'IT', 'ECE', 'IP', 'BM', 'CIVIL', 'MC', 'ME', 'CE'];
const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

const YEAR_OPTIONS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

const YEAR_SEMESTER_MAP = {
  '1': [1, 2],
  '2': [3, 4],
  '3': [5, 6],
  '4': [7, 8],
};

function DeleteModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Delete Student</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-800">{name}</span>? This will also remove their login access. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-xl disabled:opacity-60">
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
          <button onClick={onCancel} className="flex-1 btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState('');
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const allowedSemesters = year ? YEAR_SEMESTER_MAP[String(year)] || [] : [];

  const handleSessionChange = (value) => {
    setSession(value);
    setPage(1);
  };

  const handleYearChange = (value) => {
    setYear(value);
    setBranch('');
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleBranchChange = (value) => {
    setBranch(value);
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleSemesterChange = (value) => {
    setSemester(value);
    setSection('');
    setPage(1);
  };

  const handleSectionChange = (value) => {
    setSection(value);
    setPage(1);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (session) params.set('session', session);
      if (year) params.set('year', year);
      if (branch) params.set('branch', branch);
      if (semester) params.set('semester', semester);
      if (section) params.set('section', section);
      const { data } = await api.get(`/admin/students?${params}`);
      setStudents(data.data.students);
      setTotal(data.data.total);
      setPages(data.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, session, year, branch, semester, section]);

  const filtered = search
    ? students.filter(s => `${s.firstName} ${s.lastName} ${s.enrollmentNo} ${s.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/students/${deleteTarget._id}`);
      toast.success('Student deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (session) params.set('session', session);
      if (year) params.set('year', year);
      if (branch) params.set('branch', branch);
      if (semester) params.set('semester', semester);
      if (section) params.set('section', section);
      
      const response = await api.get(`/admin/students/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {deleteTarget && (
        <DeleteModal
          name={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-500 text-sm">{total} total enrolled</p>
        </div>
        {/* Enroll Student removed: students are not created by admin */}
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search name, enrollment no. or email" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={session} onChange={e => handleSessionChange(e.target.value)}>
            <option value="">All Sessions</option>
            {SESSION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-auto" value={year} onChange={e => handleYearChange(e.target.value)}>
            <option value="">All Years</option>
            {YEAR_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="input w-auto" value={branch} onChange={e => handleBranchChange(e.target.value)} disabled={!year}>
            <option value="">All Branches</option>
            {BRANCH_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="input w-auto" value={semester} onChange={e => handleSemesterChange(e.target.value)} disabled={!year}>
            <option value="">All Semesters</option>
            {allowedSemesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-auto" value={section} onChange={e => handleSectionChange(e.target.value)} disabled={!year}>
            <option value="">All Sections</option>
            {SECTION_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <button 
            onClick={handleExportExcel} 
            disabled={exporting || total === 0}
            className="btn-secondary flex items-center gap-2 py-2 px-4 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Enrollment No.', 'Name', 'Email', 'Branch', 'Sem', 'Section', ''].map(h => (
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
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.email || '—'}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                    <td className="px-4 py-3">{s.currentSemester}</td>
                    <td className="px-4 py-3">{s.section || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/admin/students/${s._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
                        <Link to={`/admin/students/${s._id}/edit`} className="text-slate-500 hover:text-slate-700" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setDeleteTarget(s)} className="text-red-400 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
