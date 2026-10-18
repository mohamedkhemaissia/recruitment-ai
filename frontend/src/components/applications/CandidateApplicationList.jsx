import { Building2, CalendarDays, ClipboardList, MapPin, RotateCw } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import LoadingState from '../ui/LoadingState.jsx';

const statusLabels = {
  submitted: 'Envoyée',
  reviewed: 'En cours d’examen',
  shortlisted: 'Présélectionnée',
  rejected: 'Non retenue',
};

const workplaceLabels = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: 'À distance',
};

const interviewStatusLabels = {
  scheduled: 'Programmé',
  completed: 'Réalisé',
  cancelled: 'Annulé',
};

const analysisStatusLabels = {
  pending: 'Analyse en attente',
  processing: 'Analyse en cours',
  completed: 'Analyse terminée',
  failed: 'Analyse indisponible',
  unavailable: 'Analyse indisponible',
};

const meetingLabels = {
  video: 'Visioconférence',
  onsite: 'Sur site',
  phone: 'Téléphone',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-TN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('fr-TN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function CandidateApplicationList({ applications, loading, error, onRetry, onBrowseOffers, onDelete }) {
  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <p className="overline">Suivi</p>
          <h1>Mes candidatures</h1>
          <p>Consultez l’état de vos candidatures envoyées.</p>
        </div>
      </section>

      {loading ? (
        <section className="card offers-state-card">
          <LoadingState label="Chargement des candidatures…" />
        </section>
      ) : error ? (
        <section className="card offers-state-card">
          <Feedback message={error} />
          <Button type="button" variant="secondary" icon={RotateCw} onClick={onRetry}>Réessayer</Button>
        </section>
      ) : applications.length === 0 ? (
        <section className="card empty-state" aria-labelledby="empty-applications-title">
          <span className="empty-state__icon" aria-hidden="true"><ClipboardList size={24} /></span>
          <h2 id="empty-applications-title">Aucune candidature</h2>
          <p>Les offres auxquelles vous postulerez apparaîtront ici.</p>
          <Button type="button" onClick={onBrowseOffers}>Consulter les offres</Button>
        </section>
      ) : (
        <section className="card offer-list-card" aria-labelledby="application-list-title">
          <div className="offer-list-card__heading">
            <div>
              <h2 id="application-list-title">Candidatures envoyées</h2>
              <p>{applications.length} candidature{applications.length > 1 ? 's' : ''}</p>
            </div>
            <span className="badge badge--primary">{applications.length}</span>
          </div>

          <div className="table-scroll">
            <table className="offer-table application-table">
              <thead>
                <tr>
                  <th>Offre</th>
                  <th>Entreprise</th>
                  <th>Localisation</th>
                  <th>Statut</th>
                  <th>Entretien</th>
                  <th>Date d’envoi</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td data-label="Offre">
                      <strong>{application.offer.title}</strong>
                      <span>{application.offer.department || 'Département non renseigné'}</span>
                    </td>
                    <td data-label="Entreprise">
                      <span className="table-detail"><Building2 size={15} aria-hidden="true" />{application.offer.companyName || 'Non renseignée'}</span>
                    </td>
                    <td data-label="Localisation">
                      <span className="table-detail"><MapPin size={15} aria-hidden="true" />{application.offer.location || 'Non renseignée'}</span>
                      <small>{workplaceLabels[application.offer.workplaceType]}</small>
                    </td>
                    <td data-label="Statut">
                      <div className="candidate-status">
                        <span className={`status-badge status-badge--${application.status}`}>{statusLabels[application.status]}</span>
                        <small className={`analysis-status analysis-status--${application.aiStatus || 'unavailable'}`}>
                          {analysisStatusLabels[application.aiStatus] || analysisStatusLabels.unavailable}
                        </small>
                      </div>
                    </td>
                    <td data-label="Entretien">
                      {application.interview ? (
                        <div className="candidate-interview">
                          <span className={`status-badge status-badge--interview-${application.interview.status}`}>
                            {interviewStatusLabels[application.interview.status]}
                          </span>
                          <span className="table-detail"><CalendarDays size={15} aria-hidden="true" />{formatDateTime(application.interview.scheduledAt)}</span>
                          <small>{meetingLabels[application.interview.meetingType]} · {application.interview.durationMinutes} min</small>
                          <small className="candidate-interview__details">{application.interview.details}</small>
                        </div>
                      ) : (
                        <small>Aucun entretien planifié</small>
                      )}
                    </td>
                    <td data-label="Date d’envoi">
                      <span className="table-detail"><CalendarDays size={15} aria-hidden="true" />{formatDate(application.createdAt)}</span>
                      <Button type="button" variant="danger" className="button--small" onClick={() => onDelete(application)}>
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default CandidateApplicationList;
