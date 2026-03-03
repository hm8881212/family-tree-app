import { useState } from 'react';
import api from '../utils/api';

interface ExistingPerson {
  first_name: string;
  last_name: string;
  dob?: string;
}

interface Props {
  familyId: string;
  onSuccess: () => void;
  existingPersons?: ExistingPerson[];
}

export default function PersonForm({ familyId, onSuccess, existingPersons = [] }: Props) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    dob: '',
    dod: '',
    is_unknown: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dupMatch, setDupMatch] = useState<ExistingPerson | null>(null);

  const doSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post(`/families/${familyId}/persons`, {
        ...form,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        dod: form.dod || undefined,
      });
      setSuccess('Person proposal submitted for admin review!');
      setForm({ first_name: '', last_name: '', gender: '', dob: '', dod: '', is_unknown: false });
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to submit proposal';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDupMatch(null);

    // Check for duplicate name+DOB before submitting
    if (!form.is_unknown && existingPersons.length > 0) {
      const match = existingPersons.find((p) => {
        const nameMatch =
          p.first_name.toLowerCase() === form.first_name.trim().toLowerCase() &&
          p.last_name.toLowerCase() === form.last_name.trim().toLowerCase();
        if (!nameMatch) return false;
        if (form.dob && p.dob) return p.dob.startsWith(form.dob);
        return nameMatch;
      });
      if (match) {
        setDupMatch(match);
        return;
      }
    }

    await doSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Duplicate confirmation dialog */}
      {dupMatch && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">
            A person named <strong>{dupMatch.first_name} {dupMatch.last_name}</strong>
            {dupMatch.dob && ` (b. ${new Date(dupMatch.dob).getFullYear()})`} already exists in this family.
          </p>
          <p className="text-sm text-amber-700">Are you sure you want to add another person with the same name?</p>
          <div className="flex gap-3">
            <button type="button" onClick={doSubmit} disabled={loading}
              className="px-4 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? 'Submitting…' : 'Yes, add anyway'}
            </button>
            <button type="button" onClick={() => setDupMatch(null)}
              className="px-4 py-1.5 border border-amber-400 text-amber-700 text-sm rounded-lg hover:bg-amber-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input type="text" required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input type="text" required value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input type="date" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Death</label>
          <input type="date" value={form.dod} onChange={(e) => setForm((f) => ({ ...f, dod: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.is_unknown} onChange={(e) => setForm((f) => ({ ...f, is_unknown: e.target.checked }))}
          className="rounded border-gray-300 text-brand-600" />
        Mark as unknown person (placeholder node)
      </label>

      <button type="submit" disabled={loading || !!dupMatch}
        className="w-full py-2 px-4 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
        {loading ? 'Submitting...' : 'Submit Proposal'}
      </button>
    </form>
  );
}
