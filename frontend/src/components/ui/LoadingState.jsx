import { LoaderCircle } from 'lucide-react';

function LoadingState({ label = 'Chargement…', fullPage = false }) {
  return (
    <div className={`loading-state ${fullPage ? 'loading-state--page' : ''}`} role="status">
      <LoaderCircle className="spinner" size={22} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default LoadingState;

