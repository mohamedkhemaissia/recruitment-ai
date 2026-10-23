import { Ban, BrainCircuit, CalendarDays, CalendarPlus, CircleCheck, ClipboardList, Download, Pencil, RotateCw, Star } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import LoadingState from '../ui/LoadingState.jsx';

function formatDateTime(value) {
  return new Intl.DateTimeFormat('fr-TN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const meetingLabels = {
  video: 'Visioconférence',
  onsite: 'Sur site',
  phone: 'Téléphone',
};

const interviewStatusLabels = {
  scheduled: 'Programmé',
  completed: 'Réalisé',
  cancelled: 'Annulé',
};

const matchBandOptions = [
  { value: '', label: 'Toutes', summaryKey: 'all' },
  { value: 'zero', label: 'Score 0 %', summaryKey: 'zero' },
  { value: 'low', label: 'Faible 1–49 %', summaryKey: 'low' },
  { value: 'aligned', label: 'Compatible ≥ 50 %', summaryKey: 'aligned' },
  { value: 'unavailable', label: 'Non analysées', summaryKey: 'unavailable' },
];

const emptyMatchMessages = {
  zero: ['Aucun score à 0 %', 'Aucune candidature analysée ne présente actuellement un score nul.'],
  low: ['Aucune compatibilité faible', 'Aucune candidature analysée ne se situe entre 1 et 49 %.'],
  aligned: ['Aucune candidature compatible', 'Aucune candidature analysée n’atteint actuellement 50 %.'],
  unavailable: ['Toutes les analyses sont disponibles', 'Aucune candidature ne nécessite une vérification technique.'],
};

function HrApplicationList({ applications, offers = [], loading, error, actionMessage, actionTone, updatingId, downloadingId, interviewUpdatingId, interviewUpdatingStatus, pagination, filters, matchingSummary = {}, onFilterChange, onFilterSubmit, onMatchBandChange, onPageChange, onRetry, onStatusChange, onDownloadCv, onScheduleInterview, onInterviewStatusChange, onEvaluateInterview }) {
  const extractionLabels = {
    completed: 'Texte extrait',
    no_text: 'PDF sans texte',
    failed: 'Extraction impossible',
    pending: 'Extraction en attente',
  };

  const analysisLabels = {
    pending: 'Analyse en attente',
    failed: 'Analyse indisponible',
    unavailable: 'CV non exploitable',
  };
  const emptyMessage = emptyMatchMessages[filters.matchBand]
    || ['Aucune candidature reçue', 'Les candidatures déposées sur vos offres apparaîtront ici.'];

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <p className="overline">Recrutement</p>
          <h1>Candidatures reçues</h1>
          <p>Consultez les profils et suivez leur avancement.</p>
        </div>
      </section>

      <div className="match-filter-tabs" role="group" aria-label="Filtrer par compatibilité IA">
        {matchBandOptions.map((option) => (
          <button
            type="button"
            key={option.summaryKey}
            className={(filters.matchBand || '') === option.value ? 'is-active' : ''}
            aria-pressed={(filters.matchBand || '') === option.value}
            onClick={() => onMatchBandChange(option.value)}
          >
            <span>{option.label}</span>
            <strong>{matchingSummary[option.summaryKey] ?? 0}</strong>
          </button>
        ))}
      </div>

      <form className="application-filters" onSubmit={onFilterSubmit}>
        <input name="search" value={filters.search} onChange={onFilterChange} placeholder="Rechercher un candidat ou une offre" aria-label="Rechercher un candidat ou une offre" />
        <select name="status" value={filters.status} onChange={onFilterChange} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="submitted">Reçues</option>
          <option value="reviewed">En cours d’examen</option>
          <option value="shortlisted">Présélectionnées</option>
          <option value="rejected">Non retenues</option>
        </select>
        <select name="jobOfferId" value={filters.jobOfferId || ''} onChange={onFilterChange} aria-label="Filtrer par offre">
          <option value="">Toutes les offres</option>
          {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
        </select>
        <select name="sort" value={filters.sort} onChange={onFilterChange} aria-label="Trier les candidatures">
          <option value="date">Trier par date</option>
          <option value="score" disabled={!filters.jobOfferId}>Trier par score de l’offre</option>
        </select>
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>

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
        <section className="card empty-state" aria-labelledby="empty-hr-applications-title">
          <span className="empty-state__icon" aria-hidden="true"><ClipboardList size={24} /></span>
          <h2 id="empty-hr-applications-title">{emptyMessage[0]}</h2>
          <p>{emptyMessage[1]}</p>
        </section>
      ) : (
        <section className="card offer-list-card" aria-labelledby="hr-application-list-title">
          <div className="offer-list-card__heading">
            <div>
              <h2 id="hr-application-list-title">Profils candidats</h2>
              <p>{pagination.total} candidature{pagination.total > 1 ? 's' : ''}</p>
            </div>
            <span className="badge badge--primary">{pagination.total}</span>
          </div>

          {actionMessage && (
            <div className="offer-list-feedback">
              <Feedback message={actionMessage} tone={actionTone} />
            </div>
          )}

          <div className="table-scroll table-scroll--hr-applications">
            <table className="offer-table hr-application-table">
              <thead>
                <tr>
                  <th>Candidat</th>
                  <th>Offre</th>
                  <th>CV</th>
                  <th>Analyse IA</th>
                  <th>Statut</th>
                  <th>Entretien</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td data-label="Candidat">
                      <strong>{application.candidate.firstName} {application.candidate.lastName}</strong>
                      <span>{application.candidate.professionalTitle || application.candidate.email}</span>
                      {application.candidate.professionalTitle && <small>{application.candidate.email}</small>}
                      {application.cvSkills?.length > 0 ? (
                        <div className="skill-list" aria-label="Compétences du CV">
                          {application.cvSkills.slice(0, 4).map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
                          {application.cvSkills.length > 4 && <span className="skill-tag skill-tag--more">+{application.cvSkills.length - 4}</span>}
                        </div>
                      ) : (
                        <small className="skill-empty">Aucune compétence identifiée</small>
                      )}
                    </td>
                    <td data-label="Offre">
                      <strong>{application.offer.title}</strong>
                      <span>{application.offer.department || 'Département non renseigné'}</span>
                    </td>
                    <td data-label="CV">
                      <Button type="button" variant="secondary" className="button--small" icon={Download} loading={downloadingId === application.id} disabled={Boolean(downloadingId)} onClick={() => onDownloadCv(application)}>
                        Télécharger
                      </Button>
                      <small className="cv-file-name">{application.cvOriginalName}</small>
                      <small className={`extraction-status extraction-status--${application.cvExtractionStatus || 'pending'}`}>
                        {extractionLabels[application.cvExtractionStatus] || extractionLabels.pending}
                      </small>
                    </td>
                    <td data-label="Analyse IA">
                      {application.aiStatus === 'completed' ? (
                        (() => {
                          const score = application.finalScore ?? application.semanticScore;
                          const semanticScore = application.semanticScore;
                          const skillScore = application.skillScore;
                          const roundedScore = Math.round(Number(score) || 0);

                          return (
                        <div className="ai-analysis" style={{ '--ai-score': `${Math.max(0, Math.min(100, roundedScore)) * 3.6}deg` }}>
                          <div className="ai-analysis__heading">
                            <span className="ai-analysis__icon" aria-hidden="true"><BrainCircuit size={15} /></span>
                            <span>
                              <span className="ai-analysis__label">Aide à la décision</span>
                              <span className="ai-analysis__model">
                              </span>
                            </span>
                          </div>
                          <div className="ai-score-summary">
                            <div className="ai-score" aria-label={`Score final indicatif ${roundedScore} pour cent`}>
                              <strong>{roundedScore}%</strong>
                            </div>
                            <span><strong>Compatibilité</strong><small>Score final indicatif</small></span>
                          </div>
                          {semanticScore !== null && semanticScore !== undefined && skillScore !== null && skillScore !== undefined && (
                            <small className="ai-skills">
                              Sémantique : {Math.round(Number(semanticScore))}% · Compétences : {Math.round(Number(skillScore))}%
                            </small>
                          )}
                        </div>
                          );
                        })()
                      ) : (
                        <span className={`analysis-status analysis-status--${application.aiStatus || 'pending'}`}>
                          {analysisLabels[application.aiStatus] || analysisLabels.pending}
                        </span>
                      )}
                    </td>
                    <td data-label="Statut">
                      <select
                        className={`status-select status-select--${application.status}`}
                        value={application.status}
                        disabled={updatingId === application.id}
                        aria-label={`Statut de ${application.candidate.firstName} ${application.candidate.lastName}`}
                        onChange={(event) => onStatusChange(application, event.target.value)}
                      >
                        <option value="submitted">Reçue</option>
                        <option value="reviewed">En cours d’examen</option>
                        <option value="shortlisted">Présélectionnée</option>
                        <option value="rejected">Non retenue</option>
                      </select>
                    </td>
                    <td data-label="Entretien">
                      {application.interview ? (
                        <div className="interview-summary">
                          <span className={`status-badge status-badge--interview-${application.interview.status}`}>
                            {interviewStatusLabels[application.interview.status]}
                          </span>
                          <span className="table-detail"><CalendarDays size={15} aria-hidden="true" />{formatDateTime(application.interview.scheduledAt)}</span>
                          <small>{meetingLabels[application.interview.meetingType]} · {application.interview.durationMinutes} min</small>
                          {application.interview.status === 'scheduled' && (
                            <div className="interview-actions">
                              <Button type="button" variant="secondary" className="button--small" icon={Pencil} disabled={Boolean(interviewUpdatingId)} onClick={() => onScheduleInterview(application)}>
                                Modifier
                              </Button>
                              <Button type="button" variant="secondary" className="button--small" icon={CircleCheck} loading={interviewUpdatingId === application.interview.id && interviewUpdatingStatus === 'completed'} disabled={Boolean(interviewUpdatingId)} onClick={() => onInterviewStatusChange(application, 'completed')}>
                                Réalisé
                              </Button>
                              <Button type="button" variant="danger" className="button--small" icon={Ban} loading={interviewUpdatingId === application.interview.id && interviewUpdatingStatus === 'cancelled'} disabled={Boolean(interviewUpdatingId)} onClick={() => onInterviewStatusChange(application, 'cancelled')}>
                                Annuler
                              </Button>
                            </div>
                          )}
                          {application.interview.status === 'completed' && (
                            <div className="interview-evaluation">
                              {application.interview.evaluationScore ? (
                                <>
                                  <span className="evaluation-score"><Star size={15} aria-hidden="true" />{application.interview.evaluationScore}/5</span>
                                  <small className="evaluation-notes">{application.interview.evaluationNotes}</small>
                                </>
                              ) : (
                                <small>Non évalué</small>
                              )}
                              <Button type="button" variant="secondary" className="button--small" icon={Star} onClick={() => onEvaluateInterview(application)}>
                                {application.interview.evaluatedAt ? 'Modifier' : 'Évaluer'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : application.status === 'rejected' ? (
                        <small>Non planifiable</small>
                      ) : (
                        <Button type="button" variant="secondary" className="button--small" icon={CalendarPlus} onClick={() => onScheduleInterview(application)}>
                          Planifier
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <Button type="button" variant="secondary" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Précédente</Button>
              <span>Page {pagination.page} sur {pagination.totalPages}</span>
              <Button type="button" variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Suivante</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default HrApplicationList;
