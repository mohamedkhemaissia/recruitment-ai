import { LoaderCircle } from 'lucide-react';

function Button({ children, icon: Icon, loading = false, disabled = false, variant = 'primary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`button button--${variant} ${className}`.trim()}
      disabled={loading || disabled}
      aria-busy={loading}
    >
      {loading ? (
        <LoaderCircle className="spinner" size={18} aria-hidden="true" />
      ) : Icon ? (
        <Icon size={18} aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export default Button;
