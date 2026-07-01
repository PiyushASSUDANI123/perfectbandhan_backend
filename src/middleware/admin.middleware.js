module.exports = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  
  console.warn('[Admin Middleware] Unauthorized access attempt blocked for user:', req.user?.phone);
  return res.status(403).json({
    status: 'error',
    message: 'Access denied. Admin privileges are required to perform this action.'
  });
};
