const errorHandler = (err, req, res, next) => {
  console.error(`[PRAMAN Server Error] ${req.method} ${req.originalUrl}:`, err.message);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Multer file size / upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size limit exceeded. Maximum file size allowed is 10 MB.';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // Supabase / PostgreSQL unique constraint violation (code 23505)
  if (err.code === '23505') {
    statusCode = 400;
    message = 'Duplicate record found. A record with this unique identifier already exists.';
  }

  // Supabase / PostgreSQL foreign key violation (code 23503)
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced entity not found or invalid reference.';
  }

  // Validation or bad request error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
