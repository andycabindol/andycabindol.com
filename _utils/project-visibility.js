// Match the work grid's thumbnail → cover fallback.
function isProjectVisible(data) {
  return process.env.NODE_ENV !== 'production' || Boolean(data.thumbnail || data.cover);
}

module.exports = { isProjectVisible };
