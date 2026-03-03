import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import AddRelationshipForm from '../components/AddRelationshipForm';
import PhotoUpload from '../components/PhotoUpload';
import api from '../utils/api';

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string;
  dob?: string;
  dod?: string;
  photo_url?: string;
  is_unknown: boolean;
  created_at: string;
}

interface Relationship {
  id: string;
  label: string;
  related_person: { id: string; first_name: string; last_name: string };
  type: string;
  subtype?: string;
  direction: string;
}

interface HistoryEntry {
  id: string;
  snapshot: Person;
  changed_by: string;
  changed_at: string;
  actor_email?: string;
}

export default function PersonPage() {
  const { familyId, personId } = useParams<{ familyId: string; personId: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mode, setMode] = useState<'indian' | 'international'>('international');
  const [tab, setTab] = useState<'info' | 'relationships' | 'history'>('info');
  const [editing, setEditing] = useState(false);
  const [showRelForm, setShowRelForm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Person>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!familyId || !personId) return;
    try {
      const [pRes, relRes, treeRes, histRes] = await Promise.all([
        api.get(`/persons/${personId}`).catch(() => null),
        api.get(`/persons/${personId}/relationships?mode=${mode}`).catch(() => ({ data: { relationships: [] } })),
        api.get(`/families/${familyId}/tree`).catch(() => ({ data: { persons: [] } })),
        api.get(`/persons/${personId}/history`).catch(() => ({ data: { history: [] } })),
      ]);
      const p = pRes?.data?.person;
      if (p) { setPerson(p); setEditForm(p); }
      setRelationships(relRes.data.relationships ?? []);
      setAllPersons(treeRes.data.persons ?? []);
      setHistory(histRes.data.history ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [familyId, personId, mode]);

  const handleSave = async () => {
    if (!personId) return;
    setSaving(true);
    try {
      await api.put(`/persons/${personId}`, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        gender: editForm.gender,
        dob: editForm.dob || undefined,
        dod: editForm.dod || undefined,
      });
      await load();
      setEditing(false);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!personId || !confirm('Propose deletion of this person? An admin must approve.')) return;
    try {
      await api.delete(`/persons/${personId}`);
      navigate(`/families/${familyId}`);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    }
  };

  if (loading) return <AppLayout><div className="text-center py-12 text-gray-400">Loading...</div></AppLayout>;
  if (!person) return <AppLayout><div className="text-center py-12 text-red-500">Person not found.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to={`/families/${familyId}`} className="text-sm text-brand-600 hover:underline">← Back to family tree</Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-start gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-700 flex-shrink-0">
          {person.photo_url
            ? <img src={person.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
            : person.is_unknown ? '?' : `${person.first_name[0]}${person.last_name[0]}`}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            {person.is_unknown ? 'Unknown Person' : `${person.first_name} ${person.last_name}`}
          </h1>
          {person.gender && <p className="text-sm text-gray-500 capitalize mt-1">{person.gender}</p>}
          <div className="flex gap-4 mt-1 text-sm text-gray-400">
            {person.dob && <span>b. {new Date(person.dob).toLocaleDateString()}</span>}
            {person.dod && <span>d. {new Date(person.dod).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={handleDelete}
            className="px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-xl border border-brand-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Edit Person (goes to admin for approval)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input value={editForm.first_name ?? ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input value={editForm.last_name ?? ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
              <select value={editForm.gender ?? ''} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
              <input type="date" value={editForm.dob?.split('T')[0] ?? ''} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Death</label>
              <input type="date" value={editForm.dod?.split('T')[0] ?? ''} onChange={(e) => setEditForm({ ...editForm, dod: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Photo</label>
            <PhotoUpload personId={person.id} currentPhotoUrl={person.photo_url}
              onSuccess={(url) => { setPerson({ ...person, photo_url: url }); }} />
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Propose Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['info', 'relationships', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'relationships' ? `Relationships (${relationships.length})` : t}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-400">Full name</dt><dd className="font-medium text-gray-800 mt-0.5">{person.first_name} {person.last_name}</dd></div>
            <div><dt className="text-gray-400">Gender</dt><dd className="font-medium text-gray-800 mt-0.5 capitalize">{person.gender ?? '—'}</dd></div>
            <div><dt className="text-gray-400">Date of birth</dt><dd className="font-medium text-gray-800 mt-0.5">{person.dob ? new Date(person.dob).toLocaleDateString() : '—'}</dd></div>
            <div><dt className="text-gray-400">Date of death</dt><dd className="font-medium text-gray-800 mt-0.5">{person.dod ? new Date(person.dod).toLocaleDateString() : '—'}</dd></div>
            <div><dt className="text-gray-400">Status</dt><dd className="mt-0.5">{person.is_unknown ? <span className="text-gray-400 italic">Unknown / placeholder</span> : <span className="text-green-600 font-medium">Known</span>}</dd></div>
            <div><dt className="text-gray-400">Added</dt><dd className="font-medium text-gray-800 mt-0.5">{new Date(person.created_at).toLocaleDateString()}</dd></div>
          </dl>
        </div>
      )}

      {tab === 'relationships' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Relationships</h3>
            <div className="flex gap-2 items-center">
              <button onClick={() => setMode(mode === 'indian' ? 'international' : 'indian')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${mode === 'indian' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                {mode === 'indian' ? '🇮🇳 Indian' : '🌍 International'}
              </button>
              <button onClick={() => setShowRelForm(!showRelForm)}
                className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700">
                + Add
              </button>
            </div>
          </div>

          {showRelForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <AddRelationshipForm familyId={familyId!} fromPerson={person} allPersons={allPersons}
                onSuccess={() => { setShowRelForm(false); load(); }}
                onCancel={() => setShowRelForm(false)} />
            </div>
          )}

          {relationships.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No relationships yet.</p>
          ) : (
            <div className="space-y-3">
              {relationships.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-800">
                      {r.related_person.first_name} {r.related_person.last_name}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">({r.label})</span>
                    {r.subtype && <span className="ml-1 text-xs text-gray-400 capitalize">· {r.subtype}</span>}
                  </div>
                  <Link to={`/families/${familyId}/persons/${r.related_person.id}`}
                    className="text-xs text-brand-600 hover:underline">View →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Edit History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No changes recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {history.map((h, i) => (
                <div key={h.id} className="border-l-2 border-gray-200 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      {i === history.length - 1 ? 'Created' : `Version ${history.length - i}`}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(h.changed_at).toLocaleString()}</span>
                    {h.actor_email && <span className="text-xs text-gray-400">by {h.actor_email}</span>}
                  </div>
                  <div className="text-sm text-gray-600">
                    {h.snapshot.first_name} {h.snapshot.last_name}
                    {h.snapshot.gender && <span className="ml-2 capitalize text-gray-400">· {h.snapshot.gender}</span>}
                    {h.snapshot.dob && <span className="ml-2 text-gray-400">· b. {new Date(h.snapshot.dob).getFullYear()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
