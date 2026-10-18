import { useEffect, useRef, useState } from 'react';
import ApplicationForm from './components/applications/ApplicationForm.jsx';
import CandidateApplicationList from './components/applications/CandidateApplicationList.jsx';
import HrApplicationList from './components/applications/HrApplicationList.jsx';
import HrDashboard from './components/dashboard/HrDashboard.jsx';
import InterviewSchedulerModal from './components/interviews/InterviewSchedulerModal.jsx';
import InterviewEvaluationModal from './components/interviews/InterviewEvaluationModal.jsx';
import AuthPanel from './components/auth/AuthPanel.jsx';
import AppShell from './components/layout/AppShell.jsx';
import JobOfferForm from './components/offers/JobOfferForm.jsx';
import JobOfferList from './components/offers/JobOfferList.jsx';
import ProfilePanel from './components/profile/ProfilePanel.jsx';
import LoadingState from './components/ui/LoadingState.jsx';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Une erreur est survenue.');
  }

  return data;
}

const initialAuthForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

const initialJobOfferForm = {
  title: '',
  department: '',
  location: '',
  employmentType: 'full_time',
  workplaceType: 'onsite',
  description: '',
  requirements: '',
};

const initialOfferFilters = {
  search: '',
  employmentType: '',
  workplaceType: '',
  status: '',
};

const initialInterviewForm = {
  scheduledAt: '',
  durationMinutes: '45',
  meetingType: 'video',
  details: '',
};

const initialInterviewEvaluation = {
  score: '',
  notes: '',
};

function toLocalDateTime(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function App() {
  const [initializing, setInitializing] = useState(true);
  const [mode, setMode] = useState('login');
  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [jobOfferForm, setJobOfferForm] = useState(initialJobOfferForm);
  const [offers, setOffers] = useState([]);
  const [offerFilters, setOfferFilters] = useState(initialOfferFilters);
  const [applicationOffer, setApplicationOffer] = useState(null);
  const [applicationFile, setApplicationFile] = useState(null);
  const [applicationConsent, setApplicationConsent] = useState(false);
  const [applications, setApplications] = useState([]);
  const applicationsRef = useRef([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [hrApplications, setHrApplications] = useState([]);
  const [hrApplicationPagination, setHrApplicationPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [hrApplicationFilters, setHrApplicationFilters] = useState({ search: '', status: '', sort: 'score' });
  const [hrApplicationsLoading, setHrApplicationsLoading] = useState(false);
  const [hrApplicationsError, setHrApplicationsError] = useState('');
  const [hrApplicationActionMessage, setHrApplicationActionMessage] = useState('');
  const [hrApplicationActionTone, setHrApplicationActionTone] = useState('success');
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [downloadingCvId, setDownloadingCvId] = useState(null);
  const [interviewApplication, setInterviewApplication] = useState(null);
  const [interviewForm, setInterviewForm] = useState(initialInterviewForm);
  const [interviewError, setInterviewError] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewUpdatingId, setInterviewUpdatingId] = useState(null);
  const [interviewUpdatingStatus, setInterviewUpdatingStatus] = useState(null);
  const [evaluationApplication, setEvaluationApplication] = useState(null);
  const [interviewEvaluation, setInterviewEvaluation] = useState(initialInterviewEvaluation);
  const [evaluationError, setEvaluationError] = useState('');
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [offerActionMessage, setOfferActionMessage] = useState('');
  const [offerActionTone, setOfferActionTone] = useState('success');
  const [offerActionId, setOfferActionId] = useState(null);
  const [deletingOfferId, setDeletingOfferId] = useState(null);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [editingOfferStatus, setEditingOfferStatus] = useState('draft');
  const [currentView, setCurrentView] = useState('offers');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('error');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    applicationsRef.current = applications;
  }, [applications]);

  const showMessage = (text, tone = 'error') => {
    setMessage(text);
    setMessageTone(tone);
  };

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then((data) => {
        setUser(data.user);
        if (data.user.role === 'hr') setCurrentView('dashboard');
      })
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    apiRequest('/api/profile')
      .then((data) => setProfile(data.profile))
      .catch((error) => showMessage(error.message));
  }, [user?.id]);

  const loadDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const data = await apiRequest('/api/dashboard');
      setDashboard(data.dashboard);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'hr' && currentView === 'dashboard') loadDashboard();
  }, [user?.id, currentView]);

  const loadOffers = async (filters = offerFilters) => {
    setOffersLoading(true);
    setOffersError('');

    try {
      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.set('q', filters.search.trim());
      if (filters.employmentType) searchParams.set('employmentType', filters.employmentType);
      if (filters.workplaceType) searchParams.set('workplaceType', filters.workplaceType);
      if (filters.status) searchParams.set('status', filters.status);
      const query = searchParams.toString();
      const data = await apiRequest(`/api/job-offers${query ? `?${query}` : ''}`);
      setOffers(data.offers);
    } catch (error) {
      setOffersError(error.message);
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentView === 'offers') {
      loadOffers();
    }
  }, [user?.id, currentView]);

  const loadApplications = async () => {
    setApplicationsLoading(true);
    setApplicationsError('');

    try {
      const data = await apiRequest('/api/applications');
      setApplications(data.applications);
    } catch (error) {
      setApplicationsError(error.message);
    } finally {
      setApplicationsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'candidate' && currentView === 'applications') {
      loadApplications();
    }
  }, [user?.id, currentView]);

  useEffect(() => {
    if (user?.role !== 'candidate' || currentView !== 'applications') return undefined;

    const startedAt = Date.now();
    let intervalId;
    const refreshAnalysisStatuses = async () => {
      const activeApplications = applicationsRef.current.filter((application) => (
        application.aiStatus === 'pending' || application.aiStatus === 'processing'
      ));
      if (Date.now() - startedAt > 120000) {
        window.clearInterval(intervalId);
        return;
      }
      if (activeApplications.length === 0) return;

      const statuses = await Promise.all(activeApplications.map(async (application) => {
        try {
          const data = await apiRequest(`/api/applications/${application.id}/analysis-status`);
          return { id: application.id, status: data.analysis.status === 'processing' ? 'processing' : data.analysis.applicationStatus };
        } catch {
          return null;
        }
      }));

      setApplications((current) => {
        const next = current.map((application) => {
          const update = statuses.find((item) => item?.id === application.id);
          return update ? { ...application, aiStatus: update.status } : application;
        });
        applicationsRef.current = next;
        return next;
      });
    };

    refreshAnalysisStatuses();
    intervalId = window.setInterval(refreshAnalysisStatuses, 4000);
    return () => window.clearInterval(intervalId);
  }, [user?.id, currentView]);

  const loadHrApplications = async (page = hrApplicationPagination.page, filters = hrApplicationFilters) => {
    setHrApplicationsLoading(true);
    setHrApplicationsError('');

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(hrApplicationPagination.limit) });
      if (filters.search) params.set('search', filters.search.trim());
      if (filters.status) params.set('status', filters.status);
      if (filters.sort) params.set('sort', filters.sort);
      const data = await apiRequest(`/api/applications/hr?${params.toString()}`);
      setHrApplications(data.applications);
      setHrApplicationPagination(data.pagination || { page, limit: hrApplicationPagination.limit, total: data.applications.length, totalPages: 1 });
    } catch (error) {
      setHrApplicationsError(error.message);
    } finally {
      setHrApplicationsLoading(false);
    }
  };

  const updateHrApplicationFilter = (event) => {
    setHrApplicationFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitHrApplicationFilters = (event) => {
    event.preventDefault();
    loadHrApplications(1, hrApplicationFilters);
  };

  useEffect(() => {
    if (user?.role === 'hr' && currentView === 'hr-applications') {
      loadHrApplications();
    }
  }, [user?.id, currentView]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setMessage('');
  };

  const updateAuthField = (event) => {
    setAuthForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateProfileField = (event) => {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateJobOfferField = (event) => {
    setJobOfferForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateOfferFilter = (event) => {
    setOfferFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const openApplication = (offer) => {
    setApplicationOffer(offer);
    setApplicationFile(null);
    setApplicationConsent(false);
    setMessage('');
    setCurrentView('apply');
  };

  const updateApplicationFile = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setMessage('');

    if (selectedFile && (selectedFile.type !== 'application/pdf' || selectedFile.size > 5 * 1024 * 1024)) {
      event.target.value = '';
      setApplicationFile(null);
      showMessage('Sélectionnez un fichier PDF de 5 Mo maximum.');
      return;
    }

    setApplicationFile(selectedFile);
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    if (!applicationOffer || !applicationFile) {
      showMessage('Sélectionnez votre CV au format PDF.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.set('jobOfferId', applicationOffer.id);
      formData.set('cv', applicationFile);
      formData.set('consent', String(applicationConsent));
      const data = await apiRequest('/api/applications', { method: 'POST', body: formData });

      setApplicationOffer(null);
      setApplicationFile(null);
      setApplications([]);
      setCurrentView('applications');
      setOfferActionTone('success');
      setOfferActionMessage(data.message);
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOfferFilters = (event) => {
    event.preventDefault();
    setOfferActionMessage('');
    loadOffers(offerFilters);
  };

  const resetOfferFilters = () => {
    setOfferFilters(initialOfferFilters);
    setOfferActionMessage('');
    loadOffers(initialOfferFilters);
  };

  const updateApplicationStatus = async (application, status) => {
    if (status === 'rejected' && !window.confirm(`Marquer la candidature de ${application.candidate.firstName} ${application.candidate.lastName} comme non retenue ?`)) {
      setHrApplications((current) => [...current]);
      return;
    }

    setUpdatingApplicationId(application.id);
    setHrApplicationActionMessage('');

    try {
      const data = await apiRequest(`/api/applications/${application.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setHrApplications((current) => current.map((item) => (
        item.id === application.id ? { ...item, status: data.application.status } : item
      )));
      setHrApplicationActionTone('success');
      setHrApplicationActionMessage('Le statut de la candidature a été mis à jour.');
    } catch (error) {
      setHrApplicationActionTone('error');
      setHrApplicationActionMessage(error.message);
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const downloadApplicationCv = async (application) => {
    setDownloadingCvId(application.id);
    setHrApplicationActionMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/applications/${application.id}/cv`, { credentials: 'include' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Téléchargement impossible.');
      }
      const fileUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = application.cvOriginalName || 'cv.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
      setHrApplicationActionTone('success');
      setHrApplicationActionMessage('Le CV a été téléchargé.');
    } catch (error) {
      setHrApplicationActionTone('error');
      setHrApplicationActionMessage(error.message);
    } finally {
      setDownloadingCvId(null);
    }
  };

  const deleteApplication = async (application) => {
    if (!window.confirm(`Supprimer votre candidature à l’offre « ${application.offer.title} » et le CV associé ?`)) return;
    try {
      const data = await apiRequest(`/api/applications/${application.id}`, { method: 'DELETE' });
      setApplications((current) => current.filter((item) => item.id !== application.id));
      showMessage(data.message, 'success');
    } catch (error) {
      showMessage(error.message);
    }
  };

  const openInterviewScheduler = (application) => {
    setInterviewApplication(application);
    setInterviewForm(application.interview ? {
      scheduledAt: toLocalDateTime(application.interview.scheduledAt),
      durationMinutes: String(application.interview.durationMinutes),
      meetingType: application.interview.meetingType,
      details: application.interview.details,
    } : initialInterviewForm);
    setInterviewError('');
  };

  const closeInterviewScheduler = () => {
    if (interviewLoading) return;
    setInterviewApplication(null);
    setInterviewError('');
  };

  const updateInterviewField = (event) => {
    setInterviewForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitInterview = async (event) => {
    event.preventDefault();
    if (!interviewApplication || !interviewForm.scheduledAt) return;

    setInterviewLoading(true);
    setInterviewError('');
    try {
      const isEditing = Boolean(interviewApplication.interview);
      const data = await apiRequest(isEditing ? `/api/interviews/${interviewApplication.interview.id}` : '/api/interviews', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...(isEditing ? {} : { applicationId: interviewApplication.id }),
          scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
          durationMinutes: Number(interviewForm.durationMinutes),
          meetingType: interviewForm.meetingType,
          details: interviewForm.details,
        }),
      });
      setHrApplications((current) => current.map((application) => (
        application.id === interviewApplication.id
          ? { ...application, interview: data.interview }
          : application
      )));
      setInterviewApplication(null);
      setHrApplicationActionTone('success');
      setHrApplicationActionMessage(data.message);
    } catch (error) {
      setInterviewError(error.message);
    } finally {
      setInterviewLoading(false);
    }
  };

  const updateInterviewStatus = async (application, status) => {
    const action = status === 'completed' ? 'marquer cet entretien comme réalisé' : 'annuler cet entretien';
    if (!window.confirm(`Voulez-vous ${action} ?`)) return;

    setInterviewUpdatingId(application.interview.id);
    setInterviewUpdatingStatus(status);
    setHrApplicationActionMessage('');
    try {
      const data = await apiRequest(`/api/interviews/${application.interview.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setHrApplications((current) => current.map((item) => (
        item.id === application.id ? { ...item, interview: data.interview } : item
      )));
      setHrApplicationActionTone('success');
      setHrApplicationActionMessage(data.message);
    } catch (error) {
      setHrApplicationActionTone('error');
      setHrApplicationActionMessage(error.message);
    } finally {
      setInterviewUpdatingId(null);
      setInterviewUpdatingStatus(null);
    }
  };

  const openInterviewEvaluation = (application) => {
    setEvaluationApplication(application);
    setInterviewEvaluation({
      score: application.interview.evaluationScore ? String(application.interview.evaluationScore) : '',
      notes: application.interview.evaluationNotes || '',
    });
    setEvaluationError('');
  };

  const closeInterviewEvaluation = () => {
    if (evaluationLoading) return;
    setEvaluationApplication(null);
    setEvaluationError('');
  };

  const updateInterviewEvaluationField = (event) => {
    setInterviewEvaluation((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitInterviewEvaluation = async (event) => {
    event.preventDefault();
    if (!evaluationApplication) return;

    setEvaluationLoading(true);
    setEvaluationError('');
    try {
      const data = await apiRequest(`/api/interviews/${evaluationApplication.interview.id}/evaluation`, {
        method: 'PATCH',
        body: JSON.stringify({
          score: Number(interviewEvaluation.score),
          notes: interviewEvaluation.notes,
        }),
      });
      setHrApplications((current) => current.map((application) => (
        application.id === evaluationApplication.id
          ? { ...application, interview: data.interview }
          : application
      )));
      setEvaluationApplication(null);
      setHrApplicationActionTone('success');
      setHrApplicationActionMessage(data.message);
    } catch (error) {
      setEvaluationError(error.message);
    } finally {
      setEvaluationLoading(false);
    }
  };

  const navigate = (view) => {
    if (view === 'new-offer') {
      setJobOfferForm(initialJobOfferForm);
    }
    if (view !== 'apply') {
      setApplicationOffer(null);
      setApplicationFile(null);
    }
    setEditingOfferId(null);
    setCurrentView(view);
    setMessage('');
    setOfferActionMessage('');
    setHrApplicationActionMessage('');
  };

  const editOffer = (offer) => {
    setJobOfferForm({
      title: offer.title,
      department: offer.department,
      location: offer.location,
      employmentType: offer.employmentType,
      workplaceType: offer.workplaceType,
      description: offer.description,
      requirements: offer.requirements,
    });
    setEditingOfferId(offer.id);
    setEditingOfferStatus(offer.status);
    setMessage('');
    setOfferActionMessage('');
    setCurrentView('edit-offer');
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? authForm
        : { email: authForm.email, password: authForm.password };
      const data = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setUser(data.user);
      setCurrentView(data.user.role === 'hr' ? 'dashboard' : 'offers');
      setAuthForm(initialAuthForm);
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data = await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      setProfile(data.profile);
      setUser((current) => ({
        ...current,
        firstName: data.profile.firstName,
        lastName: data.profile.lastName,
      }));
      showMessage('Profil enregistré.', 'success');
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitJobOffer = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const editing = Boolean(editingOfferId);
      const data = await apiRequest(editing ? `/api/job-offers/${editingOfferId}` : '/api/job-offers', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(jobOfferForm),
      });

      setJobOfferForm(initialJobOfferForm);
      if (editing) {
        setOffers((current) => current.map((offer) => (offer.id === data.offer.id ? data.offer : offer)));
        setEditingOfferId(null);
        setCurrentView('offers');
        setOfferActionTone('success');
        setOfferActionMessage('Les modifications ont été enregistrées.');
      } else {
        showMessage(`L’offre « ${data.offer.title} » a été enregistrée en brouillon.`, 'success');
      }
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOfferStatus = async (offer, status) => {
    const publishing = status === 'published';
    const archiving = status === 'closed';
    const confirmed = window.confirm(
      archiving
        ? `Archiver l’offre « ${offer.title} » ? Les candidatures et les CV seront conservés.`
        : publishing
        ? `Publier l’offre « ${offer.title} » ? Elle deviendra visible par les candidats.`
        : `Remettre l’offre « ${offer.title} » en brouillon ? Elle ne sera plus visible par les candidats.`,
    );

    if (!confirmed) return;

    setOfferActionId(offer.id);
    setOfferActionMessage('');

    try {
      const data = await apiRequest(`/api/job-offers/${offer.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOffers((current) => current.map((item) => (item.id === data.offer.id ? data.offer : item)));
      setOfferActionTone('success');
      setOfferActionMessage(
        archiving ? 'L’offre a été archivée. Les candidatures sont conservées.'
          : publishing ? 'L’offre est maintenant publiée.' : 'L’offre a été remise en brouillon.',
      );
    } catch (error) {
      setOfferActionTone('error');
      setOfferActionMessage(error.message);
    } finally {
      setOfferActionId(null);
    }
  };

  const deleteOffer = async (offer) => {
    const confirmed = window.confirm(`Supprimer définitivement l’offre « ${offer.title} » ?`);
    if (!confirmed) return;

    setDeletingOfferId(offer.id);
    setOfferActionMessage('');

    try {
      await apiRequest(`/api/job-offers/${offer.id}`, { method: 'DELETE' });
      setOffers((current) => current.filter((item) => item.id !== offer.id));
      setOfferActionTone('success');
      setOfferActionMessage('L’offre a été supprimée.');
    } catch (error) {
      setOfferActionTone('error');
      setOfferActionMessage(error.message);
    } finally {
      setDeletingOfferId(null);
    }
  };

  const logout = async () => {
    setLoading(true);
    setMessage('');

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setOffers([]);
      setOfferFilters(initialOfferFilters);
      setApplicationOffer(null);
      setApplicationFile(null);
      setApplications([]);
      setHrApplications([]);
      setDashboard(null);
      setCurrentView('offers');
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return <LoadingState label="Ouverture de votre espace…" fullPage />;
  }

  if (!user) {
    return (
      <AuthPanel
        mode={mode}
        setMode={changeMode}
        form={authForm}
        onChange={updateAuthField}
        onSubmit={submitAuth}
        loading={loading}
        message={message}
        messageTone={messageTone}
      />
    );
  }

  let content;

  if (currentView === 'dashboard' && user.role === 'hr') {
    content = (
      <HrDashboard
        dashboard={dashboard}
        loading={dashboardLoading}
        error={dashboardError}
        onRetry={loadDashboard}
        onViewOffers={() => navigate('offers')}
        onViewApplications={() => navigate('hr-applications')}
      />
    );
  } else if (currentView === 'offers') {
    content = (
      <JobOfferList
        user={user}
        offers={offers}
        filters={offerFilters}
        loading={offersLoading}
        error={offersError}
        actionMessage={offerActionMessage}
        actionTone={offerActionTone}
        actionOfferId={offerActionId}
        deletingOfferId={deletingOfferId}
        onFilterChange={updateOfferFilter}
        onFilterSubmit={submitOfferFilters}
        onFilterReset={resetOfferFilters}
        onRetry={() => loadOffers(offerFilters)}
        onCreate={() => navigate('new-offer')}
        onEdit={editOffer}
        onStatusChange={updateOfferStatus}
        onDelete={deleteOffer}
        onApply={openApplication}
      />
    );
  } else if (currentView === 'apply' && user.role === 'candidate' && applicationOffer) {
    content = (
      <ApplicationForm
        offer={applicationOffer}
        file={applicationFile}
        consent={applicationConsent}
        onConsentChange={(event) => setApplicationConsent(event.target.checked)}
        onFileChange={updateApplicationFile}
        onSubmit={submitApplication}
        onCancel={() => navigate('offers')}
        loading={loading}
        message={message}
        messageTone={messageTone}
      />
    );
  } else if (currentView === 'applications' && user.role === 'candidate') {
    content = (
      <CandidateApplicationList
        applications={applications}
        loading={applicationsLoading}
        error={applicationsError}
        onRetry={loadApplications}
        onBrowseOffers={() => navigate('offers')}
        onDelete={deleteApplication}
      />
    );
  } else if (currentView === 'hr-applications' && user.role === 'hr') {
    content = (
      <>
        <HrApplicationList
          applications={hrApplications}
          loading={hrApplicationsLoading}
          error={hrApplicationsError}
          actionMessage={hrApplicationActionMessage}
          actionTone={hrApplicationActionTone}
          updatingId={updatingApplicationId}
          downloadingId={downloadingCvId}
          interviewUpdatingId={interviewUpdatingId}
          interviewUpdatingStatus={interviewUpdatingStatus}
          onRetry={loadHrApplications}
          onStatusChange={updateApplicationStatus}
          onDownloadCv={downloadApplicationCv}
          onScheduleInterview={openInterviewScheduler}
          onInterviewStatusChange={updateInterviewStatus}
          onEvaluateInterview={openInterviewEvaluation}
          pagination={hrApplicationPagination}
          filters={hrApplicationFilters}
          onFilterChange={updateHrApplicationFilter}
          onFilterSubmit={submitHrApplicationFilters}
          onPageChange={(page) => loadHrApplications(page, hrApplicationFilters)}
        />
        <InterviewSchedulerModal
          application={interviewApplication}
          form={interviewForm}
          loading={interviewLoading}
          error={interviewError}
          onChange={updateInterviewField}
          onSubmit={submitInterview}
          onClose={closeInterviewScheduler}
        />
        <InterviewEvaluationModal
          application={evaluationApplication}
          form={interviewEvaluation}
          loading={evaluationLoading}
          error={evaluationError}
          onChange={updateInterviewEvaluationField}
          onSubmit={submitInterviewEvaluation}
          onClose={closeInterviewEvaluation}
        />
      </>
    );
  } else if (['new-offer', 'edit-offer'].includes(currentView) && user.role === 'hr') {
    content = (
      <JobOfferForm
        form={jobOfferForm}
        mode={currentView === 'edit-offer' ? 'edit' : 'create'}
        offerStatus={currentView === 'edit-offer' ? editingOfferStatus : 'draft'}
        onChange={updateJobOfferField}
        onSubmit={submitJobOffer}
        onCancel={() => navigate('offers')}
        loading={loading}
        message={message}
        messageTone={messageTone}
      />
    );
  } else {
    content = (
      <ProfilePanel
        user={user}
        profile={profile}
        onChange={updateProfileField}
        onSubmit={submitProfile}
        loading={loading}
        message={message}
        messageTone={messageTone}
      />
    );
  }

  return (
    <AppShell
      user={user}
      currentView={currentView}
      onNavigate={navigate}
      onLogout={logout}
      loading={loading}
    >
      {content}
    </AppShell>
  );
}

export default App;
