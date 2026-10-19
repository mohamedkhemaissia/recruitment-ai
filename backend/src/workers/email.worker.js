export function createEmailWorker({ jobService, emailSender }) {
  return {
    async processNext() {
      if (!emailSender.configured) return null;
      await jobService.recoverInterrupted();
      const job = await jobService.claimNext();
      if (!job) return null;

      try {
        await emailSender.send(job);
        return jobService.markSent(job.id);
      } catch (error) {
        await jobService.markFailed({
          id: job.id,
          errorMessage: error instanceof Error ? error.message : 'Erreur SMTP inconnue.',
        });
        throw error;
      }
    },
  };
}
