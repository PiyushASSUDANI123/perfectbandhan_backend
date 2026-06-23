const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[Warning] JWT_SECRET is not configured in auth middleware.');
}

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Auth Middleware] Unauthorized: Missing or invalid Authorization header.');
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. Authentication token is required.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach decoded user information (e.g. phone) to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error] Invalid token:', error.message);
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. Invalid or expired token.'
    });
  }
};
