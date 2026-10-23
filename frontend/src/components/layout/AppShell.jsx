import { BriefcaseBusiness, ClipboardList, FilePlus2, LayoutDashboard, LogOut, UserRound, UsersRound } from 'lucide-react';
import Brand from '../ui/Brand.jsx';
import Button from '../ui/Button.jsx';
import NotificationCenter from '../notifications/NotificationCenter.jsx';

function AppShell({
  user,
  currentView,
  onNavigate,
  onLogout,
  loading,
  notifications = [],
  unreadNotificationCount = 0,
  notificationsLoading = false,
  notificationsError = '',
  onRetryNotifications,
  onSelectNotification,
  onMarkAllNotificationsRead,
  children,
}) {
  const isHr = user.role === 'hr';
  const roleLabel = isHr ? 'Responsable RH' : 'Candidat';
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  const viewLabels = {
    dashboard: 'Vue d’ensemble',
    offers: isHr ? 'Gestion des offres' : 'Opportunités',
    'new-offer': 'Nouvelle offre',
    'edit-offer': 'Modification de l’offre',
    'hr-applications': 'Candidatures',
    applications: 'Suivi des candidatures',
    apply: 'Nouvelle candidature',
    profile: 'Profil',
  };

  return (
    <div className="app-page">
      <aside className="app-sidebar" aria-label={`Navigation ${roleLabel}`}>
        <div className="app-sidebar__brand">
          <Brand compact inverse />
        </div>

        <div className="sidebar">
          <p className="sidebar__label">Navigation</p>
          <nav className="sidebar__nav">
              {isHr && (
                <button type="button" className={currentView === 'dashboard' ? 'is-active' : ''} aria-current={currentView === 'dashboard' ? 'page' : undefined} onClick={() => onNavigate('dashboard')}>
                  <LayoutDashboard size={18} aria-hidden="true" />
                  <span>Tableau de bord</span>
                </button>
              )}
              <button type="button" className={['offers', 'edit-offer', 'apply'].includes(currentView) ? 'is-active' : ''} aria-current={['offers', 'edit-offer', 'apply'].includes(currentView) ? 'page' : undefined} onClick={() => onNavigate('offers')}>
                <BriefcaseBusiness size={18} aria-hidden="true" />
                <span>{isHr ? 'Mes offres' : 'Offres'}</span>
              </button>
              {isHr && (
                <button type="button" className={currentView === 'new-offer' ? 'is-active' : ''} aria-current={currentView === 'new-offer' ? 'page' : undefined} onClick={() => onNavigate('new-offer')}>
                  <FilePlus2 size={18} aria-hidden="true" />
                  <span>Nouvelle offre</span>
                </button>
              )}
              {isHr && (
                <button type="button" className={currentView === 'hr-applications' ? 'is-active' : ''} aria-current={currentView === 'hr-applications' ? 'page' : undefined} onClick={() => onNavigate('hr-applications')}>
                  <UsersRound size={18} aria-hidden="true" />
                  <span>Candidatures</span>
                </button>
              )}
              {!isHr && (
                <button type="button" className={currentView === 'applications' ? 'is-active' : ''} aria-current={currentView === 'applications' ? 'page' : undefined} onClick={() => onNavigate('applications')}>
                  <ClipboardList size={18} aria-hidden="true" />
                  <span>Mes candidatures</span>
                </button>
              )}
              <button type="button" className={currentView === 'profile' ? 'is-active' : ''} aria-current={currentView === 'profile' ? 'page' : undefined} onClick={() => onNavigate('profile')}>
                <UserRound size={18} aria-hidden="true" />
                <span>Mon profil</span>
              </button>
          </nav>
        </div>

      </aside>

      <section className="app-workspace">
        <header className="app-header">
          <div className="app-header__context">
            <strong>{viewLabels[currentView] || 'Bee Coders'}</strong>
          </div>
          <div className="user-menu" aria-label="Utilisateur connecté">
            {!isHr && (
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadNotificationCount}
                loading={notificationsLoading}
                error={notificationsError}
                onRetry={onRetryNotifications}
                onSelect={onSelectNotification}
                onMarkAllRead={onMarkAllNotificationsRead}
              />
            )}
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="user-menu__identity">
              <strong>{user.firstName} {user.lastName}</strong>
              <small>{roleLabel}</small>
            </span>
            <Button type="button" variant="ghost" icon={LogOut} onClick={onLogout} loading={loading} className="logout-button" aria-label="Se déconnecter" title="Se déconnecter" />
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </section>
    </div>
  );
}

export default AppShell;
