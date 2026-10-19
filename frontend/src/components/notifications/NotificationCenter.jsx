import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-TN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function NotificationCenter({ notifications, unreadCount, loading, error, onRetry, onSelect, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const selectNotification = (notification) => {
    onSelect(notification);
    setOpen(false);
  };

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={unreadCount ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-panel" role="dialog" aria-label="Notifications">
          <header className="notification-panel__header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}</span>
            </div>
            <button type="button" onClick={onMarkAllRead} disabled={!unreadCount || loading}>
              <CheckCheck size={16} aria-hidden="true" />
              Tout lire
            </button>
          </header>

          <div className="notification-panel__body" aria-live="polite">
            {loading && notifications.length === 0 && <p className="notification-state">Chargement…</p>}
            {!loading && error && (
              <div className="notification-state notification-state--error" role="alert">
                <p>{error}</p>
                <button type="button" onClick={onRetry}>Réessayer</button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && <p className="notification-state">Aucune notification pour le moment.</p>}
            {!error && notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-item${notification.readAt ? '' : ' is-unread'}`}
                onClick={() => selectNotification(notification)}
              >
                <span className="notification-item__dot" aria-hidden="true" />
                <span className="notification-item__content">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default NotificationCenter;
