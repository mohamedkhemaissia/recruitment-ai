import { Star } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Feedback from '../ui/Feedback.jsx';
import FormField from '../ui/FormField.jsx';
import Modal from '../ui/Modal.jsx';

function InterviewEvaluationModal({ application, form, loading, error, onChange, onSubmit, onClose }) {
  if (!application) return null;
  const isEditing = Boolean(application.interview.evaluatedAt);

  return (
    <Modal
      title={isEditing ? 'Modifier l’évaluation' : 'Évaluer l’entretien'}
      description={`${application.candidate.firstName} ${application.candidate.lastName} · ${application.offer.title}`}
      onClose={loading ? () => {} : onClose}
    >
      <form className="form-stack interview-form" onSubmit={onSubmit}>
        <Feedback message={error} />
        <FormField id="evaluationScore" label="Note globale *" as="select" name="score" value={form.score} onChange={onChange} required>
          <option value="">Sélectionner une note</option>
          <option value="1">1 — Insuffisant</option>
          <option value="2">2 — À améliorer</option>
          <option value="3">3 — Satisfaisant</option>
          <option value="4">4 — Très satisfaisant</option>
          <option value="5">5 — Excellent</option>
        </FormField>
        <FormField
          id="evaluationNotes"
          label="Commentaire *"
          as="textarea"
          name="notes"
          value={form.notes}
          onChange={onChange}
          minLength="3"
          maxLength="2000"
          rows="5"
          placeholder="Points forts et éléments à approfondir"
          required
        />
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Annuler</Button>
          <Button type="submit" icon={Star} loading={loading}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

export default InterviewEvaluationModal;
