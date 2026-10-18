export function createAuditService(databasePool) {
  return {
    async record({ userId, action, resourceType, resourceId, previousValue = null, newValue = null, ipAddress = null }) {
      await databasePool.query(
        `INSERT INTO audit_logs (
           user_id, action, resource_type, resource_id,
           previous_value, new_value, ip_address
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          userId,
          action,
          resourceType,
          String(resourceId),
          previousValue === null ? null : JSON.stringify(previousValue),
          newValue === null ? null : JSON.stringify(newValue),
          ipAddress,
        ],
      );
    },
  };
}
