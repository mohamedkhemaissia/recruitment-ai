import {
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  RotateCw,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import LoadingState from '../ui/LoadingState.jsx';

const applicationStatusLabels = {
  submitted: 'Reçue',
  reviewed: 'En examen',
  shortlisted: 'Présélectionnée',
  rejected: 'Non retenue',
};

const pipelineLabels = {
  submitted: 'Reçues',
  reviewed: 'En examen',
  shortlisted: 'Présélectionnées',
  rejected: 'Non retenues',
};

const meetingLabels = {
  video: 'Visioconférence',
  onsite: 'Sur site',
  phone: 'Téléphone',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-TN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('fr-TN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function HrDashboard({
  dashboard,
  loading,
  error,
  onRetry,
  onViewOffers,
  onViewApplications,
  onSelectRankingOffer,
}) {
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

  const pipeline = dashboard.pipeline || [];
  const priorities = dashboard.priorityApplications || [];
  const offers = dashboard.offers || [];
  const ranking = dashboard.ranking || [];
  const upcomingInterviews = dashboard.upcomingInterviews || [];
  const pipelineMaximum = Math.max(summary.totalApplications, 1);

  return (
    <div className="content-page dashboard-page">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="overline">Espace de pilotage</p>
          <h1>Tableau de bord RH</h1>
          <p>Identifiez rapidement les candidatures à traiter et les prochaines échéances.</p>
        </div>
        <div className="dashboard-heading__actions">
          <Button type="button" variant="secondary" icon={BriefcaseBusiness} onClick={onViewOffers}>Gérer les offres</Button>
          <Button type="button" icon={UsersRound} onClick={() => onViewApplications()}>Voir les candidatures</Button>
        </div>
      </section>

      <section className="dashboard-metrics" aria-label="Indicateurs de recrutement">
        <article className="card metric-card">
          <span className="metric-card__icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
          <div><strong>{summary.publishedOffers}</strong><span>Offres publiées</span><small>{summary.totalOffers} offre{summary.totalOffers > 1 ? 's' : ''} au total</small></div>
        </article>
        <article className="card metric-card metric-card--attention">
          <span className="metric-card__icon"><Clock3 size={20} aria-hidden="true" /></span>
          <div><strong>{summary.submittedApplications}</strong><span>Nouvelles à traiter</span><small>Action RH nécessaire</small></div>
        </article>
        <article className="card metric-card">
          <span className="metric-card__icon"><ClipboardCheck size={20} aria-hidden="true" /></span>
          <div><strong>{summary.reviewedApplications}</strong><span>En cours d’examen</span><small>{summary.shortlistedApplications} présélectionnée{summary.shortlistedApplications > 1 ? 's' : ''}</small></div>
        </article>
        <article className="card metric-card">
          <span className="metric-card__icon"><CalendarDays size={20} aria-hidden="true" /></span>
          <div><strong>{summary.upcomingInterviews}</strong><span>Entretiens à venir</span><small>{summary.completedInterviews} réalisé{summary.completedInterviews > 1 ? 's' : ''}</small></div>
        </article>
      </section>

      <div className="dashboard-command-grid">
        <section className="card dashboard-panel" aria-labelledby="priority-title">
          <header className="dashboard-panel__header">
            <div><p className="overline">Priorités</p><h2 id="priority-title">Candidatures à traiter</h2></div>
            <Button type="button" variant="ghost" className="button--small" icon={ArrowRight} onClick={() => onViewApplications()}>Voir tout</Button>
          </header>
          {priorities.length === 0 ? (
            <div className="dashboard-empty"><UserCheck size={22} aria-hidden="true" /><p>Aucune candidature en attente de traitement.</p></div>
          ) : (
            <ul className="priority-list">
              {priorities.map((application) => (
                <li key={application.id}>
                  <div className="priority-list__identity">
                    <strong>{application.candidateName}</strong>
                    <span>{application.offerTitle}</span>
                    <small>Reçue le {formatDate(application.createdAt)}</small>
                  </div>
                  <div className="priority-list__meta">
                    <span className={`status-badge status-badge--${application.status}`}>{applicationStatusLabels[application.status]}</span>
                    {application.aiStatus === 'completed' && application.score !== null && <small>Correspondance IA : {Math.round(application.score)}%</small>}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="button--small"
                    onClick={() => onViewApplications({ search: application.candidateName, status: application.status })}
                  >
                    Examiner
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card dashboard-panel" aria-labelledby="upcoming-title">
          <header className="dashboard-panel__header">
            <div><p className="overline">Agenda</p><h2 id="upcoming-title">Prochains entretiens</h2></div>
          </header>
          {upcomingInterviews.length === 0 ? (
            <div className="dashboard-empty"><CalendarDays size={22} aria-hidden="true" /><p>Aucun entretien programmé.</p></div>
          ) : (
            <ul className="interview-list">
              {upcomingInterviews.map((interview) => (
                <li key={interview.id}>
                  <span className="interview-list__date"><CalendarDays size={17} aria-hidden="true" /></span>
                  <div><strong>{interview.candidateName}</strong><small>{interview.offerTitle}</small><span>{formatDateTime(interview.scheduledAt)} · {meetingLabels[interview.meetingType]}</span></div>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="secondary" className="dashboard-panel__action" icon={ClipboardCheck} onClick={() => onViewApplications()}>Gérer les candidatures</Button>
        </section>
      </div>

      <div className="dashboard-insights-grid">
        <section className="card dashboard-panel" aria-labelledby="pipeline-title">
          <header className="dashboard-panel__header">
            <div><p className="overline">Avancement</p><h2 id="pipeline-title">Pipeline de recrutement</h2></div>
            <span className="badge badge--primary">{summary.totalApplications}</span>
          </header>
          {summary.totalApplications === 0 ? (
            <div className="dashboard-empty"><UsersRound size={22} aria-hidden="true" /><p>Aucune candidature reçue.</p></div>
          ) : (
            <div className="pipeline-list">
              {pipeline.map((step) => (
                <button type="button" key={step.status} onClick={() => onViewApplications({ status: step.status })}>
                  <span><strong>{pipelineLabels[step.status]}</strong><small>{step.count}</small></span>
                  <span className="pipeline-list__track"><i style={{ width: `${(step.count / pipelineMaximum) * 100}%` }} /></span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card dashboard-panel dashboard-ranking" aria-labelledby="ranking-title">
          <header className="dashboard-panel__header dashboard-panel__header--ranking">
            <div><p className="overline">Aide à la présélection</p><h2 id="ranking-title">Correspondances par offre</h2></div>
            {offers.length > 0 && (
              <label className="dashboard-offer-select">
                <span>Offre analysée</span>
                <select value={dashboard.selectedOfferId || ''} onChange={(event) => onSelectRankingOffer(Number(event.target.value))}>
                  {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title} ({offer.applicationCount})</option>)}
                </select>
              </label>
            )}
          </header>
          {offers.length === 0 ? (
            <div className="dashboard-empty"><BriefcaseBusiness size={22} aria-hidden="true" /><p>Créez une offre pour obtenir un classement.</p></div>
          ) : ranking.length === 0 ? (
            <div className="dashboard-empty"><BrainCircuit size={22} aria-hidden="true" /><p>Aucune candidature analysée pour cette offre.</p></div>
          ) : (
            <ol className="ranking-list">
              {ranking.map((application, index) => (
                <li key={application.id}>
                  <span className="rank-badge">#{index + 1}</span>
                  <div className="ranking-list__identity"><strong>{application.candidateName}</strong><small>{application.offerTitle}</small></div>
                  <span className={`status-badge status-badge--${application.status}`}>{applicationStatusLabels[application.status]}</span>
                  <div className="ranking-list__score"><strong>{Math.round(application.score)}%</strong><span><i style={{ width: `${application.score}%` }} /></span></div>
                </li>
              ))}
            </ol>
          )}
          <p className="dashboard-ai-notice">Le score IA est une aide à la décision. La validation finale appartient au responsable RH.</p>
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
