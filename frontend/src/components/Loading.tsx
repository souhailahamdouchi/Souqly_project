import { Loader2 } from 'lucide-react';

export default function Loading({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <Loader2 size={32} className="animate-spin text-souqly-blue" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
