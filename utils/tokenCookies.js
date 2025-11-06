const isProduction = process.env.NODE_ENV === 'production';

const defaultCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
};

function setAccessCookie(res, token, maxAgeMs = 15 * 60 * 1000) {
  res.cookie('vp_access_token', token, {
    ...defaultCookieOptions,
    maxAge: maxAgeMs,
  });
}

function clearAuthCookies(res) {
  res.clearCookie('vp_access_token', { path: '/' });
  res.clearCookie('vp_refresh_token', { path: '/' });
}

module.exports = {
  setAccessCookie,
  clearAuthCookies,
};


