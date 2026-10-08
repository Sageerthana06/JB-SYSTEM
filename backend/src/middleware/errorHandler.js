const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Clean handling for Request Entity Too Large / Multer file size errors
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413 || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Photo must be 5MB or smaller.'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal Server Error' : message,
  });
};

module.exports = errorHandler;
