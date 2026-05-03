'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Laptop, BookOpen, Briefcase, Smartphone, Package, Plus, X, Pencil, Check } from 'lucide-react';
import api from '@/lib/api';
import styles from './BelongingsList.module.css';

type BelongingType = 'laptop' | 'book' | 'bag' | 'device' | 'other';
interface Belonging { description: string; type: BelongingType | string; }

const ICON_MAP: Record<string, any> = {
  laptop: Laptop, book: BookOpen, bag: Briefcase, device: Smartphone, other: Package,
};
const TYPES = ['laptop', 'book', 'bag', 'device', 'other'];

interface Props {
  belongings: Belonging[];
  sessionId: string;
  editable: boolean;
  onUpdate: () => void;
}

export default function BelongingsList({ belongings, sessionId, editable, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Belonging[]>(belongings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (i: number, field: keyof Belonging, value: string) =>
    setItems((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  const addItem = () => setItems((prev) => [...prev, { description: '', type: 'other' }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/sessions/${sessionId}/belongings`, { belongings: items.filter(b => b.description.trim()) });
      setEditing(false); onUpdate();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const cancel = () => { setItems(belongings); setEditing(false); setError(''); };

  return (
    <div>
      <div className={styles.header}>
        <p className={styles.sectionLabel}>Declared Belongings</p>
        {editable && !editing && (
          <motion.button whileTap={{ scale: 0.95 }} className={`btn btn-ghost btn-sm`} onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={1.5} /> Edit
          </motion.button>
        )}
      </div>

      {error && <div className="alert alert-error mb-2">{error}</div>}

      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {belongings.length === 0 ? (
              <p className="text-muted text-sm">No items declared.</p>
            ) : (
              <div className={styles.chipList}>
                {belongings.map((b, i) => {
                  const Icon = ICON_MAP[b.type] || Package;
                  return (
                    <motion.div
                      key={i}
                      className={styles.chip}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Icon size={13} strokeWidth={1.5} className={styles.chipIcon} />
                      <span>{b.description}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.editList}>
              {items.map((b, i) => (
                <div key={i} className={styles.editRow}>
                  <select
                    id={`edit-type-${i}`} className="form-select" style={{ width: 130 }}
                    value={b.type} onChange={(e) => update(i, 'type', e.target.value)}
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <input
                    id={`edit-desc-${i}`} className="form-input" style={{ flex: 1 }}
                    value={b.description} onChange={(e) => update(i, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                  <motion.button whileTap={{ scale: 0.9 }} type="button" className={styles.removeBtn} onClick={() => removeItem(i)}>
                    <X size={13} strokeWidth={2} />
                  </motion.button>
                </div>
              ))}
            </div>
            <div className={styles.editActions}>
              <motion.button whileTap={{ scale: 0.97 }} type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                <Plus size={13} strokeWidth={2} /> Add item
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} id="save-belongings-btn" type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <><div className="spinner" />Saving</> : <><Check size={13} strokeWidth={2} /> Save</>}
              </motion.button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
