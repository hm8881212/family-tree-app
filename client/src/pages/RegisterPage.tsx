import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import api from '../utils/api';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteToken = searchParams.get('invite') ?? '';

  const [invite, setInvite] = useState<{ email: string; family_name: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteToken) { setInviteError('No invite token. Please use an invite link.'); return; }
    api.get(`/invites/${inviteToken}/validate`)
      .then((res) => {
        setInvite(res.data);
        setForm((f) => ({ ...f, email: res.data.email }));
      })
      .catch(() => setInviteError('Invalid or expired invite link.'));
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { email: form.email, password: form.password, invite_token: inviteToken });
      setSuccess('Registration successful! Please check your email to verify your account.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account">
      {inviteError ? (
        <div className="text-center">
          <p className="text-red-600 mb-4">{inviteError}</p>
          <Link to="/login" className="text-brand-600 hover:underline">Back to login</Link>
        </div>
      ) : !invite ? (
        <p className="text-center text-gray-500">Validating invite...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm text-brand-700">
            Invited to join <strong>{invite.family_name}</strong>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={form.email} readOnly
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" required minLength={8} value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
