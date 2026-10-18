export function createAiAnalysisWorker({ jobService, analyze, onFailure = null }) {
  return {
    async processNext() {
      if (jobService.enqueueMissing) await jobService.enqueueMissing();
      await jobService.recoverStaleProcessing();
      const job = await jobService.claimNext();
      if (!job) return null;

      try {
        await analyze(job);
        return jobService.updateStatus({ id: job.id, status: 'completed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur IA inconnue.';
        const failedJob = await jobService.updateStatus({
          id: job.id,
          status: 'failed',
          errorMessage: message,
        });
        if (onFailure) await onFailure(job, failedJob);
        throw error;
      }
    },
  };
}
