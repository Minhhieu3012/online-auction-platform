const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message: message,
    data: data,
  });
};

const sendError = (res, errorCode, message, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    error_code: errorCode,
    message: message,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
