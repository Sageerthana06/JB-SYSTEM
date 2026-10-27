const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Clean handling for Request Entity Too Large / Multer file size errors
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413 || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Image size must not exceed 20 MB.'
    });
  }

  // Clean handling for Database Quota Exceeded (PostgreSQL / Neon error 53000)
  if (err.code === '53000' || (err.message && err.message.includes('exceeded the quota'))) {
    return res.status(503).json({
      success: false,
      message: 'Database quota exceeded on Neon Cloud. Please upgrade your Neon plan or update DATABASE_URL in backend/.env.'
    });
  }

  // Database Connection Timeout / Unreachable
  if (err.message && (err.message.includes("Can't reach database") || err.message.includes('connection timeout') || err.message.includes('Connection terminated'))) {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed or timed out. Please verify your database connection in backend/.env.'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? (process.env.NODE_ENV === 'development' ? message : 'Internal Server Error') : message,
  });
};

module.exports = errorHandler;
