import { CalendarPlus, Pencil } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';
import Modal from '../ui/Modal.jsx';

function minimumDateTime() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function InterviewSchedulerModal({ application, form, loading, error, onChange, onSubmit, onClose }) {
  if (!application) return null;
  const isEditing = Boolean(application.interview);

  return (
    <Modal
      title={isEditing ? 'Modifier l’entretien' : 'Planifier un entretien'}
      description={`${application.candidate.firstName} ${application.candidate.lastName} · ${application.offer.title}`}
      onClose={loading ? () => {} : onClose}
    >
      <form className="form-stack interview-form" onSubmit={onSubmit}>
        <Feedback message={error} />
        <div className="form-grid">
          <FormField id="interviewDate" label="Date et heure *" type="datetime-local" name="scheduledAt" value={form.scheduledAt} min={minimumDateTime()} onChange={onChange} required />
          <FormField id="interviewDuration" label="Durée *" as="select" name="durationMinutes" value={form.durationMinutes} onChange={onChange} required>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 heure</option>
            <option value="90">1 h 30</option>
            <option value="120">2 heures</option>
          </FormField>
        </div>
        <FormField id="interviewType" label="Format *" as="select" name="meetingType" value={form.meetingType} onChange={onChange} required>
          <option value="video">Visioconférence</option>
          <option value="onsite">Sur site</option>
          <option value="phone">Téléphone</option>
        </FormField>
        <FormField
          id="interviewDetails"
          label="Lieu, lien ou numéro de téléphone *"
          name="details"
          value={form.details}
          onChange={onChange}
          minLength="3"
          maxLength="500"
          placeholder="Ex. Bureau 4, lien de visioconférence ou numéro"
          required
        />
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Annuler</Button>
          <Button type="submit" icon={isEditing ? Pencil : CalendarPlus} loading={loading}>
            {isEditing ? 'Enregistrer' : 'Planifier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default InterviewSchedulerModal;
