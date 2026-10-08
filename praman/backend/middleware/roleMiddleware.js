/**
 * Restricts route access to specific roles.
 * @param  {...string} allowedRoles - e.g. 'admin', 'investigator', 'forensic'
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: '${req.user.role}' role does not have permission to access this resource.`,
      });
    }

    next();
  };
};

module.exports = { authorize };
