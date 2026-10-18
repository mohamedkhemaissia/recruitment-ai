import { ArrowRight, BrainCircuit, BriefcaseBusiness, CalendarDays, ClipboardList, RotateCw, UsersRound } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import LoadingState from '../ui/LoadingState.jsx';

const applicationStatusLabels = {
  submitted: 'Reçue',
  reviewed: 'En examen',
  shortlisted: 'Présélectionnée',
  rejected: 'Non retenue',
};

const meetingLabels = {
  video: 'Visioconférence',
  onsite: 'Sur site',
  phone: 'Téléphone',
};

function formatDateTime(value) {
  return new Intl.DateTimeFormat('fr-TN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function HrDashboard({ dashboard, loading, error, onRetry, onViewOffers, onViewApplications }) {
  if (loading) {
    return <div className="content-page"><section className="card dashboard-state"><LoadingState label="Chargement du tableau de bord…" /></section></div>;
  }

  if (error) {
    return (
      <div className="content-page">
        <section className="card dashboard-state">
          <Feedback message={error} />
          <Button type="button" variant="secondary" icon={RotateCw} onClick={onRetry}>Réessayer</Button>
        </section>
      </div>
    );
  }

  const summary = dashboard?.summary;
  if (!summary) return null;

  return (
    <div className="content-page dashboard-page">
      <section className="page-heading">
        <div>
          <p className="overline">Vue d’ensemble</p>
          <h1>Tableau de bord</h1>
          <p>Suivez l’activité de recrutement et les prochaines actions.</p>
        </div>
      </section>

      <section className="dashboard-metrics" aria-label="Indicateurs de recrutement">
        <article className="card metric-card">
          <span className="metric-card__icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
          <div><strong>{summary.totalOffers}</strong><span>Offres</span><small>{summary.publishedOffers} publiée{summary.publishedOffers > 1 ? 's' : ''}</small></div>
        </article>
        <article className="card metric-card">
          <span className="metric-card__icon"><UsersRound size={20} aria-hidden="true" /></span>
          <div><strong>{summary.totalApplications}</strong><span>Candidatures</span><small>{summary.shortlistedApplications} présélectionnée{summary.shortlistedApplications > 1 ? 's' : ''}</small></div>
        </article>
        <article className="card metric-card">
          <span className="metric-card__icon"><BrainCircuit size={20} aria-hidden="true" /></span>
          <div><strong>{summary.averageAiScore}%</strong><span>Score IA moyen</span><small>{summary.analyzedApplications} analysée{summary.analyzedApplications > 1 ? 's' : ''}</small></div>
        </article>
        <article className="card metric-card">
          <span className="metric-card__icon"><CalendarDays size={20} aria-hidden="true" /></span>
          <div><strong>{summary.upcomingInterviews}</strong><span>Entretiens à venir</span><small>{summary.completedInterviews} réalisé{summary.completedInterviews > 1 ? 's' : ''}</small></div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="card dashboard-panel" aria-labelledby="ranking-title">
          <header className="dashboard-panel__header">
            <div><p className="overline">Aide à la présélection</p><h2 id="ranking-title">Meilleurs scores IA</h2></div>
            <Button type="button" variant="ghost" className="button--small" icon={ArrowRight} onClick={onViewApplications}>Voir tout</Button>
          </header>
          {dashboard.ranking.length === 0 ? (
            <div className="dashboard-empty"><BrainCircuit size={22} aria-hidden="true" /><p>Aucune candidature analysée.</p></div>
          ) : (
            <ol className="ranking-list">
              {dashboard.ranking.map((application, index) => (
                <li key={application.id}>
                  <span className="rank-badge">#{index + 1}</span>
                  <div className="ranking-list__identity"><strong>{application.candidateName}</strong><small>{application.offerTitle}</small></div>
                  <span className={`status-badge status-badge--${application.status}`}>{applicationStatusLabels[application.status]}</span>
                  <div className="ranking-list__score"><strong>{Math.round(application.score)}%</strong><span><i style={{ width: `${application.score}%` }} /></span></div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card dashboard-panel" aria-labelledby="upcoming-title">
          <header className="dashboard-panel__header">
            <div><p className="overline">Agenda</p><h2 id="upcoming-title">Prochains entretiens</h2></div>
          </header>
          {dashboard.upcomingInterviews.length === 0 ? (
            <div className="dashboard-empty"><CalendarDays size={22} aria-hidden="true" /><p>Aucun entretien programmé.</p></div>
          ) : (
            <ul className="interview-list">
              {dashboard.upcomingInterviews.map((interview) => (
                <li key={interview.id}>
                  <span className="interview-list__date"><CalendarDays size={17} aria-hidden="true" /></span>
                  <div><strong>{interview.candidateName}</strong><small>{interview.offerTitle}</small><span>{formatDateTime(interview.scheduledAt)} · {meetingLabels[interview.meetingType]}</span></div>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="secondary" className="dashboard-panel__action" icon={ClipboardList} onClick={onViewApplications}>Gérer les candidatures</Button>
        </section>
      </div>

      {summary.totalOffers === 0 && (
        <section className="card dashboard-onboarding">
          <div><h2>Commencez par créer une offre</h2><p>Les indicateurs apparaîtront dès les premières candidatures.</p></div>
          <Button type="button" icon={ArrowRight} onClick={onViewOffers}>Gérer les offres</Button>
        </section>
      )}
    </div>
  );
}

export default HrDashboard;
