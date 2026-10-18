import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import Brand from '../ui/Brand.jsx';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';

function AuthPanel({ mode, setMode, form, onChange, onSubmit, loading, message, messageTone }) {
  const isRegister = mode === 'register';

  const switchMode = (nextMode) => {
    setMode(nextMode);
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-labelledby="product-title">
        <Brand />
        <div className="auth-hero__content">
          <p className="overline">Plateforme de recrutement</p>
          <h1 id="product-title">Le recrutement, mieux organisé.</h1>
          <p>
            Centralisez les offres, les candidatures et les entretiens dans un espace clair conçu pour les équipes RH et les candidats.
          </p>
        </div>
        <p className="auth-hero__footer">Une expérience simple, structurée et assistée par l’intelligence artificielle.</p>
      </section>

      <section className="auth-workspace" aria-label="Accès au compte">
        <div className="auth-workspace__mobile-brand"><Brand compact /></div>
        <div className="card auth-card">
          <div className="auth-tabs" aria-label="Authentification">
            <button
              type="button"
              aria-pressed={!isRegister}
              className={!isRegister ? 'is-active' : ''}
              onClick={() => switchMode('login')}
            >
              Connexion
            </button>
            <button
              type="button"
              aria-pressed={isRegister}
              className={isRegister ? 'is-active' : ''}
              onClick={() => switchMode('register')}
            >
              Inscription
            </button>
          </div>

          <div className="card-heading">
            <span className="card-heading__icon" aria-hidden="true">
              {isRegister ? <UserPlus size={21} /> : <LogIn size={21} />}
            </span>
            <div>
              <h2>{isRegister ? 'Créer un compte candidat' : 'Ravi de vous revoir'}</h2>
              <p>{isRegister ? 'Renseignez vos informations pour commencer.' : 'Connectez-vous pour accéder à votre espace.'}</p>
            </div>
          </div>

          <form className="form-stack" onSubmit={onSubmit}>
            {isRegister && (
              <div className="form-grid">
                <FormField id="firstName" label="Prénom" name="firstName" value={form.firstName} onChange={onChange} maxLength="80" autoComplete="given-name" required />
                <FormField id="lastName" label="Nom" name="lastName" value={form.lastName} onChange={onChange} maxLength="80" autoComplete="family-name" required />
              </div>
            )}

            <FormField id="email" label="Adresse e-mail" name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" placeholder="nom@exemple.com" required />
            <FormField id="password" label="Mot de passe" name="password" type="password" value={form.password} onChange={onChange} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" hint={isRegister ? '8 caractères minimum' : undefined} required />

            <Feedback message={message} tone={messageTone} />
            <Button type="submit" loading={loading} icon={ArrowRight}>
              {isRegister ? 'Créer mon compte' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default AuthPanel;
