import { AuditLog } from "../modules/audit/audit-log.model.js";

export const auditLogMiddleware = (action) => async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    try {
      await AuditLog.create({
        action,
        method: req.method,
        path: req.originalUrl,
        actorId: req.user?._id,
        actorEmail: req.user?.email,
        ipAddress: req.ip,
        statusCode: res.statusCode,
        metadata: {
          body: req.body,
          params: req.params,
          query: req.query
        }
      });
    } catch (_error) {
    }

    return originalJson(body);
  };

  next();
};
