function serializeNotification(notification) {
  return {
    id: notification.id,
    applicationId: notification.application_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.read_at,
    createdAt: notification.created_at,
  };
}

export function createNotificationController(notificationService) {
  return {
    list: async (request, response, next) => {
      try {
        const result = await notificationService.listForUser(request.user.id);
        return response.json({
          notifications: result.notifications.map(serializeNotification),
          unreadCount: result.unreadCount,
        });
      } catch (error) {
        return next(error);
      }
    },

    markRead: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return response.status(400).json({ message: 'Notification invalide.' });
        }
        const notification = await notificationService.markRead({ id, userId: request.user.id });
        if (!notification) {
          return response.status(404).json({ message: 'Notification introuvable.' });
        }
        return response.json({ notification: serializeNotification(notification) });
      } catch (error) {
        return next(error);
      }
    },

    markAllRead: async (request, response, next) => {
      try {
        const updated = await notificationService.markAllRead(request.user.id);
        return response.json({ updated });
      } catch (error) {
        return next(error);
      }
    },
  };
}
