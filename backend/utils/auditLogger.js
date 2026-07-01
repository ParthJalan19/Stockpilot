const AuditLog = require('../models/AuditLog');

const logAudit = async (req, { action, targetCollection, targetId, before = null, after = null }) => {
  try {
    if (!req.user) return; // User must be logged in

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Simple browser/device parsing from User-Agent string
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    let device = 'Desktop';
    if (userAgent.includes('Mobi') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      device = 'Mobile';
    }

    await AuditLog.create({
      organizationId: req.orgId,
      userId: req.user._id,
      userName: req.user.name,
      action,
      targetCollection,
      targetId,
      before,
      after,
      ip,
      device,
      browser
    });
  } catch (error) {
    console.error(`[AuditLogger] Error writing audit log: ${error.message}`);
  }
};

module.exports = { logAudit };
