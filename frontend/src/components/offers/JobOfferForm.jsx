import { FileText, Save } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';

function JobOfferForm({ form, mode = 'create', offerStatus = 'draft', onChange, onSubmit, onCancel, loading, message, messageTone }) {
  const editing = mode === 'edit';
  const statusLabel = offerStatus === 'published' ? 'Publiée' : 'Brouillon';

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <p className="overline">Offres d’emploi</p>
          <h1>{editing ? 'Modifier l’offre' : 'Créer une offre'}</h1>
          <p>{editing ? 'Mettez à jour les informations nécessaires.' : 'Renseignez les informations essentielles. L’offre sera enregistrée en brouillon.'}</p>
        </div>
        <span className={`status-badge status-badge--${offerStatus}`}>{statusLabel}</span>
      </section>

      <section className="card profile-card" aria-labelledby="offer-form-title">
        <div className="section-heading">
          <span className="section-heading__icon" aria-hidden="true"><FileText size={20} /></span>
          <div>
            <h2 id="offer-form-title">Informations de l’offre</h2>
            <p>Les champs marqués d’un astérisque sont obligatoires.</p>
          </div>
        </div>

        <form className="form-stack profile-form" onSubmit={onSubmit}>
          <FormField id="offerTitle" label="Intitulé du poste *" name="title" value={form.title} onChange={onChange} minLength="3" maxLength="150" placeholder="Ex. Développeur React" required />

          <div className="form-grid">
            <FormField id="department" label="Département" name="department" value={form.department} onChange={onChange} maxLength="120" placeholder="Ex. Produit et technologie" />
            <FormField id="offerLocation" label="Localisation" name="location" value={form.location} onChange={onChange} maxLength="120" placeholder="Ex. Tunis" />
          </div>

          <div className="form-grid">
            <FormField id="employmentType" label="Type de contrat *" as="select" name="employmentType" value={form.employmentType} onChange={onChange} required>
              <option value="full_time">Temps plein</option>
              <option value="part_time">Temps partiel</option>
              <option value="fixed_term">Contrat à durée déterminée</option>
              <option value="internship">Stage</option>
              <option value="freelance">Freelance</option>
            </FormField>
            <FormField id="workplaceType" label="Mode de travail *" as="select" name="workplaceType" value={form.workplaceType} onChange={onChange} required>
              <option value="onsite">Sur site</option>
              <option value="hybrid">Hybride</option>
              <option value="remote">À distance</option>
            </FormField>
          </div>

          <FormField id="description" label="Description du poste *" as="textarea" name="description" value={form.description} onChange={onChange} minLength="20" maxLength="5000" rows="7" placeholder="Décrivez les missions, les responsabilités et le contexte du poste." hint={`${form.description.length}/5000 caractères`} required />
          <FormField id="requirements" label="Exigences du poste *" as="textarea" name="requirements" value={form.requirements} onChange={onChange} minLength="20" maxLength="5000" rows="7" placeholder="Décrivez les compétences, l’expérience et les qualifications attendues." hint={`${form.requirements.length}/5000 caractères`} required />

          <Feedback message={message} tone={messageTone} />
          <div className="form-actions">
            {editing && <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Annuler</Button>}
            <Button type="submit" icon={Save} loading={loading}>{editing ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default JobOfferForm;
