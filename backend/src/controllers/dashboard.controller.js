export function createDashboardController(dashboardService) {
  return {
    get: async (request, response, next) => {
      try {
        const rawOfferId = request.query.offerId;
        const offerId = rawOfferId === undefined ? null : Number(rawOfferId);
        if (rawOfferId !== undefined && (!Number.isSafeInteger(offerId) || offerId < 1)) {
          return response.status(400).json({ message: 'Offre invalide.' });
        }
        const dashboard = await dashboardService.getForHr(request.user.id, { offerId });
        return response.json({ dashboard });
      } catch (error) {
        return next(error);
      }
    },
  };
}
