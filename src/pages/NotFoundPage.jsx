import { ArrowLeft, KeyRound } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col items-center justify-center p-4">
      <div className="brutal-card-lg bg-studio-white w-full max-w-md p-6 text-center sm:p-8">
        <span className="border-studio-ink bg-studio-lime text-studio-ink inline-block border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase">
          404 • ROUTE NOT FOUND
        </span>
        <h1 className="font-display mt-3 text-4xl leading-none font-black uppercase sm:text-5xl">
          Page Not Found
        </h1>
        <p className="text-studio-muted-ink mt-3 text-xs leading-relaxed font-medium sm:text-sm">
          The page you requested does not exist at 37 Music Studio. Return to the public website or
          sign in to the staff portal.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/"
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to public website</span>
          </Link>

          <Link
            to="/staff/login"
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Staff / Owner Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
