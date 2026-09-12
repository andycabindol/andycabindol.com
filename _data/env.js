module.exports = {
  isProduction: process.env.NODE_ENV === 'production',
  /** Play nav + /playground/ — hidden on production builds for now. */
  showPlayground: process.env.NODE_ENV !== 'production',
};
