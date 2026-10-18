import { Save, UserRound } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';
import LoadingState from '../ui/LoadingState.jsx';

function ProfilePanel({ user, profile, onChange, onSubmit, loading, message, messageTone }) {
  const roleLabel = user.role === 'hr' ? 'Responsable RH' : 'Candidat';

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <p className="overline">Espace {user.role === 'hr' ? 'RH' : 'candidat'}</p>
          <h1>Mon profil</h1>
          <p>Gardez vos informations personnelles et professionnelles à jour.</p>
        </div>
        <span className="badge badge--primary">{roleLabel}</span>
      </section>

      <section className="card profile-card" aria-labelledby="profile-title">
        <div className="section-heading">
          <span className="section-heading__icon" aria-hidden="true"><UserRound size={20} /></span>
          <div>
            <h2 id="profile-title">Informations du profil</h2>
            <p>Les champs peuvent être modifiés à tout moment.</p>
          </div>
        </div>

        {!profile ? (
          <LoadingState label="Chargement du profil…" />
        ) : (
          <form className="form-stack profile-form" onSubmit={onSubmit}>
            <div className="form-grid">
              <FormField id="profileFirstName" label="Prénom" name="firstName" value={profile.firstName} onChange={onChange} maxLength="80" autoComplete="given-name" required />
              <FormField id="profileLastName" label="Nom" name="lastName" value={profile.lastName} onChange={onChange} maxLength="80" autoComplete="family-name" required />
            </div>

            <div className="form-grid">
              <FormField id="profileEmail" label="Adresse e-mail" type="email" value={profile.email} disabled />
              <FormField id="phone" label="Téléphone" name="phone" type="tel" value={profile.phone} onChange={onChange} maxLength="30" autoComplete="tel" placeholder="Ex. +216 20 000 000" />
            </div>

            {profile.role === 'hr' ? (
              <div className="form-grid">
                <FormField id="companyName" label="Entreprise" name="companyName" value={profile.companyName} onChange={onChange} maxLength="120" autoComplete="organization" />
                <FormField id="jobTitle" label="Fonction" name="jobTitle" value={profile.jobTitle} onChange={onChange} maxLength="120" autoComplete="organization-title" />
              </div>
            ) : (
              <div className="form-grid">
                <FormField id="professionalTitle" label="Titre professionnel" name="professionalTitle" value={profile.professionalTitle} onChange={onChange} maxLength="120" placeholder="Ex. Développeur frontend" />
                <FormField id="location" label="Localisation" name="location" value={profile.location} onChange={onChange} maxLength="120" autoComplete="address-level2" placeholder="Ex. Tunis" />
              </div>
            )}

            <FormField id="bio" label="Présentation" as="textarea" name="bio" value={profile.bio} onChange={onChange} maxLength="1000" rows="5" placeholder="Présentez brièvement votre parcours professionnel." />

            <Feedback message={message} tone={messageTone} />
            <div className="form-actions">
              <Button type="submit" icon={Save} loading={loading}>Enregistrer les modifications</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default ProfilePanel;
