import { useRef, useState } from 'react';
import api from '../utils/api';

interface Props {
  personId: string;
  currentPhotoUrl?: string;
  onSuccess: (url: string) => void;
}

export default function PhotoUpload({ personId, currentPhotoUrl, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP allowed'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Max file size is 5MB'); return;
    }

    setError('');
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setProgress(10);

    try {
      // 1. Get presigned URL
      const { data } = await api.post('/uploads/photo-url', {
        person_id: personId,
        content_type: file.type,
      });
      setProgress(30);

      // 2. Upload directly to R2/S3
      await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      setProgress(80);

      // 3. Confirm & update person record
      await api.post('/uploads/photo-confirm', {
        person_id: personId,
        public_url: data.public_url,
      });
      setProgress(100);
      onSuccess(data.public_url);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          uploading ? 'border-brand-300 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
        }`}
      >
        {preview || currentPhotoUrl ? (
          <img src={preview ?? currentPhotoUrl} alt="" className="w-24 h-24 rounded-full object-cover mx-auto mb-2" />
        ) : (
          <div className="text-4xl mb-2">📷</div>
        )}
        <p className="text-sm font-medium text-gray-600">
          {uploading ? `Uploading… ${progress}%` : 'Click or drag photo here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · max 5MB</p>
        {uploading && (
          <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
