// Source unique du secret JWT — utilisée par AuthModule (signature) et
// JwtStrategy (validation) pour qu'ils ne puissent pas diverger.
// En environnement déployé (Vercel), l'absence de JWT_SECRET est une erreur
// fatale : on refuse de démarrer plutôt que de signer avec un secret public.
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.VERCEL) {
    throw new Error(
      'JWT_SECRET is not set — refusing to boot with the insecure dev fallback in production.',
    );
  }
  return 'secretKey'; // dev local uniquement
}
