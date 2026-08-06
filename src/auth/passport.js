import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from '../config.js';

export function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      photos: user.photos,
    });
  });

  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  if (!config.ghClientId || !config.ghClientSecret) {
    console.warn('[auth] GH_CLIENT_ID / GH_CLIENT_SECRET not set — OAuth login disabled');
    return;
  }

  passport.use(
    new GitHubStrategy(
      {
        clientID: config.ghClientId,
        clientSecret: config.ghClientSecret,
        callbackURL: `${config.appUrl}/auth/callback`,
      },
      (accessToken, refreshToken, profile, done) => {
        // Never persist tokens; username allowlist is the gate.
        const username = (profile.username || '').toLowerCase();
        const allowed = config.allowedGithubUsernames.includes(username);
        if (!allowed) {
          const err = new Error('FORBIDDEN');
          err.code = 'FORBIDDEN';
          err.username = profile.username;
          return done(err, null);
        }
        return done(null, {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          photos: profile.photos || [],
        });
      }
    )
  );
}
