import { CircleAlert, CircleCheck } from 'lucide-react';

function Feedback({ message, tone = 'error' }) {
  if (!message) return null;

  const Icon = tone === 'success' ? CircleCheck : CircleAlert;

  return (
    <div className={`feedback feedback--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export default Feedback;

