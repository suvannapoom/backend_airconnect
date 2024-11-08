exports.login = async (req, res, next) => {
  try {
    res.json({ message: "test login" });
  } catch (error) {
    next(error);
  }
};
