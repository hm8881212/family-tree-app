import { useState } from 'react';
import api from '../utils/api';

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  is_unknown: boolean;
}

interface Props {
  familyId: string;
  fromPerson: Person;
  allPersons: Person[];
  onSuccess: () => void;
  onCancel: () => void;
}

const REL_TYPES = [
  { value: 'parent_of', label: 'Parent of' },
  { value: 'spouse_of', label: 'Spouse of' },
  { value: 'sibling_of', label: 'Sibling of' },
  { value: 'adopted_by', label: 'Adopted by' },
];

const SUBTYPES: Record<string, string[]> = {
  parent_of: ['biological', 'step', 'adoptive'],
  spouse_of: ['current', 'former'],
  sibling_of: ['full', 'half'],
  adopted_by: [],
};

export default function AddRelationshipForm({ familyId, fromPerson, allPersons, onSuccess, onCancel }: Props) {
  const [toPersonId, setToPersonId] = useState('');
  const [relType, setRelType] = useState('parent_of');
  const [subtype, setSubtype] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const others = allPersons.filter((p) => p.id !== fromPerson.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPersonId) { setError('Select a person'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/relationships', {
        family_id: familyId,
        from_person_id: fromPerson.id,
        to_person_id: toPersonId,
        type: relType,
        subtype: subtype || undefined,
        started_at: startedAt || undefined,
        ended_at: endedAt || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const subtypeOptions = SUBTYPES[relType] ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <span className="text-brand-600">{fromPerson.first_name} {fromPerson.last_name}</span> is...
        </label>
        <select value={relType} onChange={(e) => { setRelType(e.target.value); setSubtype(''); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          {REL_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">...of person:</label>
        <select value={toPersonId} onChange={(e) => setToPersonId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Select person...</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.is_unknown ? 'Unknown' : `${p.first_name} ${p.last_name}`}
            </option>
          ))}
        </select>
      </div>

      {subtypeOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subtype (optional)</label>
          <select value={subtype} onChange={(e) => setSubtype(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">None</option>
            {subtypeOptions.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
      )}

      {(relType === 'spouse_of' || relType === 'adopted_by') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
            <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
            <input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Submitting…' : 'Propose Relationship'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">Relationship goes to admin for approval</p>
    </form>
  );
}
