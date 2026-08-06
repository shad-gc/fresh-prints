import { Router } from 'express';
import passport from 'passport';
import { loginPageHtml, forbiddenPageHtml } from '../auth/pages.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/');
  }
  const error = req.query.error || null;
  res.type('html').send(loginPageHtml({ error }));
});

router.get('/github', passport.authenticate('github', { scope: ['read:user'] }));

router.get(
  '/callback',
  (req, res, next) => {
    passport.authenticate('github', (err, user) => {
      if (err && err.code === 'FORBIDDEN') {
        return res.status(403).type('html').send(forbiddenPageHtml({ username: err.username }));
      }
      if (err || !user) {
        return res.redirect('/auth/login?error=failed');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return res.redirect('/auth/login?error=failed');
        // MUST redirect to "/" — not "/#/" (hash-router loops)
        return res.redirect('/');
      });
    })(req, res, next);
  }
);

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/auth/login');
    });
  });
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      username: req.user.username,
      displayName: req.user.displayName,
    },
  });
});

export default router;
