'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Laptop, BookOpen, Briefcase, Smartphone, Package } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './records.module.css';

interface Session {
  _id: string; status: string;
  belongings: { description: string; type: string }[];
  createdAt: string; entryTime?: string; exitTime?: string; flagNotes?: string;
  student: { name: string; email: string; rollNumber?: string; department?: string };
  guard?: { name: string };
}

const ICON_MAP: Record<string, any> = {
  laptop: Laptop, book: BookOpen, bag: Briefcase, device: Smartphone, other: Package,
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', active: 'Active', exiting: 'Exiting', completed: 'Completed', flagged: 'Flagged',
};

const fmt = (d?: string) => d ? new Date(d).toLocaleString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const dur = (e?: string, x?: string) => {
  if (!e || !x) return '—';
  const m = Math.round((new Date(x).getTime() - new Date(e).getTime()) / 60000);
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;
};

export default function GuardRecordsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'guard') { router.replace('/student/dashboard'); return; }
  }, [user, router]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFilter) params.set('date', dateFilter);
      const { data } = await api.get(`/sessions?${params}`);
      setSessions(data.sessions);
    } finally { setLoading(false); }
  }, [search, statusFilter, dateFilter]);

  useEffect(() => { const t = setTimeout(fetchRecords, 350); return () => clearTimeout(t); }, [fetchRecords]);

  return (
    <div className="page">
      {/* Header */}
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1>Records</h1>
          <p className="text-muted" style={{ marginTop: '.375rem', fontWeight: 300, fontSize: '.875rem' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => router.push('/guard/dashboard')} className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} strokeWidth={1.5} /> Dashboard
        </motion.button>
      </motion.div>

      {/* Filters */}
      <motion.div
        className={styles.filters}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
      >
        <div className={styles.searchWrap}>
          <Search size={15} strokeWidth={1.5} className={styles.searchIcon} />
          <input
            id="search-input"
            className={`form-input ${styles.searchInput}`}
            placeholder="Search by name, roll number or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select id="status-filter" className={`form-select ${styles.filterSelect}`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input id="date-filter" type="date" className={`form-input ${styles.filterSelect}`} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        {(search || statusFilter || dateFilter) && (
          <button id="clear-filters-btn" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); }}>
            Clear
          </button>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        className="table-wrap"
        style={{ marginTop: '1.5rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll No.</th>
              <th>Department</th>
              <th>Status</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Duration</th>
              <th>Items</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem' }}>
                <div className="spinner spinner-dark" style={{ margin: '0 auto' }} />
              </td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--stone)' }}>
                No sessions found
              </td></tr>
            ) : sessions.map((s) => (
              <>
                <tr key={s._id} onClick={() => setExpanded(expanded === s._id ? null : s._id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--charcoal)', fontSize: '.875rem' }}>{s.student.name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--stone)', marginTop: '.125rem' }}>{s.student.email}</div>
                  </td>
                  <td>
                    <code style={{ fontSize: '.78rem', background: 'var(--surface-2)', padding: '.2rem .5rem', borderRadius: 4, color: 'var(--grey)' }}>
                      {s.student.rollNumber || '—'}
                    </code>
                  </td>
                  <td className="text-sm">{s.student.department || '—'}</td>
                  <td><span className={`badge badge-${s.status}`}><span className="badge-dot" />{STATUS_LABELS[s.status]}</span></td>
                  <td className="text-sm" style={{ color: 'var(--grey)' }}>{fmt(s.entryTime)}</td>
                  <td className="text-sm" style={{ color: 'var(--grey)' }}>{fmt(s.exitTime)}</td>
                  <td className="text-sm" style={{ color: 'var(--grey)' }}>{dur(s.entryTime, s.exitTime)}</td>
                  <td className="text-sm">{s.belongings.length}</td>
                  <td style={{ color: 'var(--stone)' }}>
                    {expanded === s._id ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                  </td>
                </tr>
                {expanded === s._id && (
                  <tr key={`${s._id}-d`}>
                    <td colSpan={9} style={{ background: 'var(--surface-2)', padding: '1.25rem 1.5rem' }}>
                      <div className={styles.expandedRow}>
                        <div>
                          <p className={styles.expandLabel}>Belongings</p>
                          {s.belongings.length === 0 ? <p className="text-sm text-muted">None</p> : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.5rem' }}>
                              {s.belongings.map((b, i) => {
                                const Icon = ICON_MAP[b.type] || Package;
                                return (
                                  <span key={i} className={styles.expandChip}>
                                    <Icon size={12} strokeWidth={1.5} /> {b.description}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {s.flagNotes && (
                          <div>
                            <p className={styles.expandLabel}>Flag Notes</p>
                            <div className="alert alert-error" style={{ marginTop: '.5rem', padding: '.5rem .875rem', fontSize: '.8rem' }}>
                              <AlertTriangle size={13} strokeWidth={1.5} /> {s.flagNotes}
                            </div>
                          </div>
                        )}
                        {s.guard && (
                          <div>
                            <p className={styles.expandLabel}>Guard</p>
                            <p className="text-sm" style={{ marginTop: '.5rem' }}>{s.guard.name}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
