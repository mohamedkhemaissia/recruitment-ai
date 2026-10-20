import { useState } from 'react';
import { Archive, BriefcaseBusiness, Building2, CalendarDays, CircleCheck, Eye, FileUp, MapPin, Pencil, Plus, RotateCcw, RotateCw, Search, Send, Trash2, Undo2 } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';
import LoadingState from '../ui/LoadingState.jsx';
import Modal from '../ui/Modal.jsx';

const employmentLabels = {
  full_time: 'Temps plein',
  part_time: 'Temps partiel',
  fixed_term: 'CDD',
  internship: 'Stage',
  freelance: 'Freelance',
};

const workplaceLabels = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: 'À distance',
};

const statusLabels = {
  draft: 'Brouillon',
  published: 'Publiée',
  closed: 'Clôturée',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-TN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function JobOfferList({ user, offers, filters, loading, error, actionMessage, actionTone, actionOfferId, deletingOfferId, onFilterChange, onFilterSubmit, onFilterReset, onRetry, onCreate, onEdit, onStatusChange, onDelete, onApply }) {
  const isHr = user.role === 'hr';
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const [selectedOffer, setSelectedOffer] = useState(null);

  const applyToSelectedOffer = () => {
    const offer = selectedOffer;
    setSelectedOffer(null);
    onApply(offer);
  };

  return (
    <>
      <div className="content-page">
      <section className="page-heading">
        <div>
          <h1>{isHr ? 'Mes offres' : 'Offres disponibles'}</h1>
          <p>{isHr ? 'Consultez les offres créées par votre équipe RH.' : 'Découvrez les opportunités actuellement publiées.'}</p>
        </div>
        {isHr && <Button type="button" icon={Plus} onClick={onCreate}>Créer une offre</Button>}
      </section>

      <form className="card offer-filters" onSubmit={onFilterSubmit}>
        <div className={`offer-filters__grid ${isHr ? '' : 'offer-filters__grid--candidate'}`}>
          <FormField id="offerSearch" label="Recherche" name="search" value={filters.search} onChange={onFilterChange} maxLength="100" placeholder="Poste, département ou lieu" />
          <FormField id="filterEmploymentType" label="Contrat" as="select" name="employmentType" value={filters.employmentType} onChange={onFilterChange}>
            <option value="">Tous les contrats</option>
            <option value="full_time">Temps plein</option>
            <option value="part_time">Temps partiel</option>
            <option value="fixed_term">CDD</option>
            <option value="internship">Stage</option>
            <option value="freelance">Freelance</option>
          </FormField>
          <FormField id="filterWorkplaceType" label="Mode de travail" as="select" name="workplaceType" value={filters.workplaceType} onChange={onFilterChange}>
            <option value="">Tous les modes</option>
            <option value="onsite">Sur site</option>
            <option value="hybrid">Hybride</option>
            <option value="remote">À distance</option>
          </FormField>
          {isHr && (
            <FormField id="filterStatus" label="Statut" as="select" name="status" value={filters.status} onChange={onFilterChange}>
              <option value="">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="published">Publiée</option>
              <option value="closed">Clôturée</option>
            </FormField>
          )}
        </div>
        <div className="offer-filters__actions">
          <Button type="button" variant="ghost" icon={RotateCcw} disabled={loading || !hasActiveFilters} onClick={onFilterReset}>Réinitialiser</Button>
          <Button type="submit" icon={Search} loading={loading}>Rechercher</Button>
        </div>
      </form>

      {loading ? (
        <section className="card offers-state-card">
          <LoadingState label="Chargement des offres…" />
        </section>
      ) : error ? (
        <section className="card offers-state-card">
          <Feedback message={error} />
          <Button type="button" variant="secondary" icon={RotateCw} onClick={onRetry}>Réessayer</Button>
        </section>
      ) : offers.length === 0 ? (
        <section className="card empty-state" aria-labelledby="empty-offers-title">
          {actionMessage && <Feedback message={actionMessage} tone={actionTone} />}
          <span className="empty-state__icon" aria-hidden="true"><BriefcaseBusiness size={24} /></span>
          <h2 id="empty-offers-title">{hasActiveFilters ? 'Aucune offre trouvée' : isHr ? 'Aucune offre créée' : 'Aucune offre disponible'}</h2>
          <p>{hasActiveFilters ? 'Modifiez ou réinitialisez vos critères de recherche.' : isHr ? 'Créez votre première offre pour démarrer le recrutement.' : 'De nouvelles opportunités seront affichées ici dès leur publication.'}</p>
          {hasActiveFilters
            ? <Button type="button" variant="secondary" icon={RotateCcw} onClick={onFilterReset}>Réinitialiser les filtres</Button>
            : isHr && <Button type="button" icon={Plus} onClick={onCreate}>Créer une offre</Button>}
        </section>
      ) : (
        <section className="offer-results" aria-label={isHr ? 'Offres enregistrées' : 'Opportunités ouvertes'}>
          {actionMessage && (
            <div className="offer-list-feedback">
              <Feedback message={actionMessage} tone={actionTone} />
            </div>
          )}

          <div className={`offer-grid ${isHr ? 'offer-grid--hr' : ''}`}>
            {offers.map((offer) => (
              <article className="offer-card" key={offer.id}>
                <header className="offer-card__header">
                  <span className="offer-card__icon" aria-hidden="true"><BriefcaseBusiness size={21} /></span>
                  {isHr && <span className={`status-badge status-badge--${offer.status}`}>{statusLabels[offer.status]}</span>}
                </header>

                <div className="offer-card__title">
                  <h3>{offer.title}</h3>
                  <p>{offer.department || offer.companyName || 'Département non renseigné'}</p>
                </div>

                <p className="offer-card__description">{offer.description}</p>

                <div className="offer-card__metadata">
                  <span><MapPin size={15} aria-hidden="true" />{offer.location || 'Non renseignée'}</span>
                  <span><BriefcaseBusiness size={15} aria-hidden="true" />{employmentLabels[offer.employmentType]}</span>
                  <span><Building2 size={15} aria-hidden="true" />{workplaceLabels[offer.workplaceType]}</span>
                </div>

                {offer.skills?.length > 0 && (
                  <div className="skill-list offer-card__skills" aria-label="Compétences identifiées">
                    {offer.skills.slice(0, 3).map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
                    {offer.skills.length > 3 && <span className="skill-tag skill-tag--more">+{offer.skills.length - 3}</span>}
                  </div>
                )}

                <footer className="offer-card__footer">
                  <span className="offer-card__date"><CalendarDays size={14} aria-hidden="true" />{formatDate(offer.publishedAt || offer.createdAt)}</span>
                  {isHr ? (
                    <div className="offer-card__actions">
                      <Button type="button" variant="secondary" className="button--small" icon={Pencil} disabled={Boolean(actionOfferId || deletingOfferId)} onClick={() => onEdit(offer)}>Modifier</Button>
                      {offer.status !== 'closed' && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="button--small"
                          icon={offer.status === 'published' ? Undo2 : Send}
                          loading={actionOfferId === offer.id}
                          disabled={Boolean(actionOfferId || deletingOfferId)}
                          onClick={() => onStatusChange(offer, offer.status === 'published' ? 'draft' : 'published')}
                        >
                          {offer.status === 'published' ? 'Brouillon' : 'Publier'}
                        </Button>
                      )}
                      {offer.status !== 'closed' && (
                        <Button type="button" variant="ghost" className="button--small offer-card__icon-action" icon={Archive} loading={actionOfferId === offer.id} disabled={Boolean(actionOfferId || deletingOfferId)} onClick={() => onStatusChange(offer, 'closed')} aria-label="Archiver l’offre" title="Archiver">
                          Archiver
                        </Button>
                      )}
                      <Button type="button" variant="danger" className="button--small offer-card__icon-action" icon={Trash2} loading={deletingOfferId === offer.id} disabled={Boolean(actionOfferId || deletingOfferId)} onClick={() => onDelete(offer)} aria-label="Supprimer l’offre" title="Supprimer">
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <div className="offer-card__actions">
                      <Button type="button" variant="secondary" className="button--small" icon={Eye} onClick={() => setSelectedOffer(offer)}>Voir l’offre</Button>
                      <Button type="button" className="button--small" icon={offer.alreadyApplied ? CircleCheck : FileUp} disabled={offer.alreadyApplied} onClick={() => onApply(offer)}>
                        {offer.alreadyApplied ? 'Déjà postulé' : 'Postuler'}
                      </Button>
                    </div>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}
      </div>

      {!isHr && selectedOffer && (
        <Modal
          title={selectedOffer.title}
          description={selectedOffer.companyName || selectedOffer.department || 'Offre d’emploi'}
          onClose={() => setSelectedOffer(null)}
        >
          <div className="offer-details">
            <div className="offer-details__metadata" aria-label="Informations principales de l’offre">
              <span><Building2 size={17} aria-hidden="true" />{selectedOffer.companyName || 'Entreprise non renseignée'}</span>
              <span><MapPin size={17} aria-hidden="true" />{selectedOffer.location || 'Localisation non renseignée'} · {workplaceLabels[selectedOffer.workplaceType]}</span>
              <span><BriefcaseBusiness size={17} aria-hidden="true" />{employmentLabels[selectedOffer.employmentType]}</span>
              <span><CalendarDays size={17} aria-hidden="true" />Publiée le {formatDate(selectedOffer.publishedAt || selectedOffer.createdAt)}</span>
            </div>

            {selectedOffer.department && <p className="offer-details__department">Département : {selectedOffer.department}</p>}

            <section className="offer-details__section">
              <h3>Description du poste</h3>
              <p>{selectedOffer.description}</p>
            </section>

            <section className="offer-details__section">
              <h3>Profil et exigences</h3>
              <p>{selectedOffer.requirements}</p>
            </section>

            {selectedOffer.skills?.length > 0 && (
              <section className="offer-details__section">
                <h3>Compétences recherchées</h3>
                <div className="skill-list">
                  {selectedOffer.skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
                </div>
              </section>
            )}

            <div className="modal-actions offer-details__actions">
              <Button type="button" variant="secondary" onClick={() => setSelectedOffer(null)}>Fermer</Button>
              <Button type="button" icon={selectedOffer.alreadyApplied ? CircleCheck : FileUp} disabled={selectedOffer.alreadyApplied} onClick={applyToSelectedOffer}>
                {selectedOffer.alreadyApplied ? 'Déjà postulé' : 'Postuler à cette offre'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default JobOfferList;
