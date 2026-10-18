import { ArrowLeft, BriefcaseBusiness, FileText, Send } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';

function ApplicationForm({ offer, file, consent, onConsentChange, onFileChange, onSubmit, onCancel, loading, message, messageTone }) {
  return (
    <div className="content-page content-page--narrow">
      <section className="page-heading">
        <div>
          <p className="overline">Candidature</p>
          <h1>Postuler à l’offre</h1>
          <p>Ajoutez votre CV au format PDF pour envoyer votre candidature.</p>
        </div>
        <Button type="button" variant="ghost" icon={ArrowLeft} onClick={onCancel}>Retour</Button>
      </section>

      <section className="card application-card">
        <div className="application-offer">
          <span className="section-heading__icon" aria-hidden="true"><BriefcaseBusiness size={20} /></span>
          <div>
            <span>Offre sélectionnée</span>
            <strong>{offer.title}</strong>
            <small>{[offer.department, offer.location].filter(Boolean).join(' · ')}</small>
          </div>
        </div>

        <form className="application-form" onSubmit={onSubmit}>
          <label className="file-field" htmlFor="candidateCv">
            <span className="field__label">CV au format PDF</span>
            <span className="file-field__control">
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>{file ? file.name : 'Sélectionner votre CV'}</strong>
                <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} Mo` : 'PDF uniquement, 5 Mo maximum'}</small>
              </span>
            </span>
            <input id="candidateCv" name="cv" type="file" accept=".pdf,application/pdf" onChange={onFileChange} required />
          </label>

          <label className="consent-field">
            <input type="checkbox" checked={consent} onChange={onConsentChange} required />
            <span>J’accepte le traitement de mes données et de mon CV pour cette candidature.</span>
          </label>

          {message && <Feedback message={message} tone={messageTone} />}

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Annuler</Button>
            <Button type="submit" icon={Send} loading={loading}>Envoyer ma candidature</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ApplicationForm;
