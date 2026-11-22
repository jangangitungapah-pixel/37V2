import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';

const STATE_CONFIG = {
  invalid: {
    icon: ShieldAlert,
    badge: 'LINK TIDAK VALID',
    title: 'Tautan Undangan Tidak Tersedia',
    description:
      'Tautan ulasan ini tidak valid, sudah kedaluwarsa, atau telah diganti dengan undangan baru dari studio.',
    accentClass: 'bg-[#FFEDE8] text-[#B92B0C] border-studio-ink',
  },
  expired: {
    icon: Clock3,
    badge: 'KEDALUWARSA',
    title: 'Masa Berlaku Undangan Berakhir',
    description:
      'Batas waktu 30 hari untuk tautan ulasan ini telah berakhir. Hubungi 37 Music Studio melalui WhatsApp jika Anda membutuhkan tautan ulasan baru.',
    accentClass: 'bg-[#FEF4DD] text-[#8A4B08] border-studio-ink',
  },
  revoked: {
    icon: ShieldAlert,
    badge: 'DICABUT',
    title: 'Tautan Undangan Sudah Tidak Aktif',
    description:
      'Undangan ini telah dicabut atau digantikan dengan tautan baru oleh tim 37 Music Studio.',
    accentClass: 'bg-[#FFEDE8] text-[#B92B0C] border-studio-ink',
  },
  submitted: {
    icon: CheckCircle2,
    badge: 'SUDAH DIGUNAKAN',
    title: 'Ulasan Sudah Pernah Dikirim',
    description:
      'Satu booking hanya dapat mengirimkan satu ulasan. Terima kasih telah membagikan pengalaman Anda bersama 37 Music Studio!',
    accentClass: 'bg-studio-lime text-studio-ink border-studio-ink',
  },
  error: {
    icon: AlertTriangle,
    badge: 'GANGGUAN KONEKSI',
    title: 'Gagal Memuat Undangan Ulasan',
    description:
      'Terjadi kendala saat menghubungkan ke sistem ulasan studio. Periksa koneksi Anda dan coba muat ulang.',
    accentClass: 'bg-[#FFEDE8] text-[#B92B0C] border-studio-ink',
  },
};

export function CustomerReviewAccessState({ state, onRetry }) {
  if (state === 'loading') {
    return (
      <div
        data-testid="public-review-loading"
        className="brutal-card bg-studio-white text-studio-ink p-8 text-center sm:p-10"
      >
        <Loader2 className="mx-auto h-7 w-7 animate-spin" aria-hidden="true" />
        <p className="mt-3 font-mono text-xs font-bold tracking-wider uppercase">
          Memverifikasi tautan undangan ulasan...
        </p>
      </div>
    );
  }

  const meta = STATE_CONFIG[state] || STATE_CONFIG.invalid;
  const Icon = meta.icon;

  return (
    <div
      data-testid={`public-review-state-${state || 'invalid'}`}
      className="brutal-card bg-studio-white text-studio-ink p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center border-2 ${meta.accentClass}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase">
          {meta.badge}
        </span>
      </div>

      <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase sm:text-4xl">
        {meta.title}
      </h2>

      <p className="text-studio-muted-ink mt-3 text-sm leading-relaxed">{meta.description}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {state === 'error' && typeof onRetry === 'function' ? (
          <button
            type="button"
            onClick={onRetry}
            className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            Coba Lagi
          </button>
        ) : null}

        <Link
          to="/"
          className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-11 items-center justify-center px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          Kembali ke 37 Music Studio
        </Link>
      </div>
    </div>
  );
}
