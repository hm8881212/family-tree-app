import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import api from '../utils/api';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No token provided.'); return; }
    api.get(`/auth/verify-email/${token}`)
      .then((res) => { setStatus('success'); setMessage(res.data.message); })
      .catch((err) => { setStatus('error'); setMessage(err.response?.data?.error ?? 'Verification failed.'); });
  }, [token]);

  return (
    <AuthLayout title="Email Verification">
      {status === 'loading' && <p className="text-center text-gray-500">Verifying...</p>}
      {status === 'success' && (
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-green-600 font-medium">{message}</p>
          <Link to="/login" className="mt-4 inline-block text-brand-600 hover:underline">Sign in now</Link>
        </div>
      )}
      {status === 'error' && (
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-600">{message}</p>
          <Link to="/login" className="mt-4 inline-block text-brand-600 hover:underline">Back to login</Link>
        </div>
      )}
    </AuthLayout>
  );
}
