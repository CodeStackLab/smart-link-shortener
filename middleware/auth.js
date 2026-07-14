function requireAuth(req, res, next) {
  if (req.session && (req.session.authenticated || req.session.isAdmin)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
}

module.exports = {
  requireAuth
};
