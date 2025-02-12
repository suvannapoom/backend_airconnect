const db = require("../config/db");

// Route to list users
exports.listUsers = async (req, res, next) => {
  try {
    console.log("Received listUsers request");

    // Query to fetch users
    const query =
      "SELECT Memid as id, MemEmail as email, MemName as name, MemCreatedate as Createdate, isVerified as status FROM tbl_user";
    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      console.log("Users retrieved successfully");
      res.json(results);
    });
  } catch (error) {
    console.error("Error in listUsers:", error);
    next(error);
  }
};
