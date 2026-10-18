export function createDashboardController(dashboardService) {
  return {
    get: async (request, response, next) => {
      try {
        const dashboard = await dashboardService.getForHr(request.user.id);
        return response.json({ dashboard });
      } catch (error) {
        return next(error);
      }
    },
  };
}
