module.exports = (err, req, res, next) => {
  console.log(err);

  err.statusCode = 400;
  err.message = err.errors[0].message;

  res.status(err.statusCode || 500).json({ message: err.message });
};
