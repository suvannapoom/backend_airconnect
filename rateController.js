const moment = require("moment-timezone");
const db = require("../config/db");

exports.vote = async (req, res, next) => {
  try {
    const { token_login, type_cal, score } = req.body; // รับค่า token_login, type_cal และ score จาก body ของคำขอ
    console.log(req.body);
    if (!token_login || !type_cal || !score) {
      return res
        .status(400)
        .json({ message: "token_login, type_cal, and score are required" });
    }

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const userQuery = "SELECT usr_id FROM tbl_users WHERE token_login = ?";
    db.query(userQuery, [token_login], (err, userResults) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (userResults.length === 0) {
        return res.status(404).json({ message: "User not found" }); // ส่ง response กลับไปยัง client ว่าไม่พบผู้ใช้
      }

      const usr_id = userResults[0].usr_id;

      // ตรวจสอบว่าผู้ใช้ได้โหวตแล้วหรือไม่
      const voteCheckQuery =
        "SELECT * FROM tbl_vote WHERE usr_id = ? AND type_cal = ? ORDER BY date_vote DESC LIMIT 1";
      db.query(voteCheckQuery, [usr_id, type_cal], (err, voteResults) => {
        if (err) {
          console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
          return next(err);
        }

        const now = moment().tz("Asia/Bangkok");
        if (voteResults.length > 0) {
          const lastVoteDate = moment(voteResults[0].date_vote)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD");
          const currentDate = now.format("YYYY-MM-DD");
          if (lastVoteDate === currentDate) {
            return res
              .status(400)
              .json({ message: "You can vote again tomorrow" }); // ส่ง response กลับไปยัง client ว่าผู้ใช้สามารถโหวตได้อีกครั้งในวันถัดไป
          }
        }

        const date_vote = now.format("YYYY-MM-DD HH:mm:ss");

        // เพิ่มข้อมูลการโหวตใหม่ในฐานข้อมูล
        const insertQuery =
          "INSERT INTO tbl_vote (usr_id, type_cal, vt_score, date_vote) VALUES (?, ?, ?, ?)";
        db.query(insertQuery, [usr_id, type_cal, score, date_vote], (err) => {
          if (err) {
            console.error("Database insert error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ insert ข้อมูล
            return next(err);
          }

          res.json({ message: "Vote added successfully" }); // ส่ง response กลับไปยัง client ว่าเพิ่มการโหวตสำเร็จ
        });
      });
    });
  } catch (error) {
    console.error("Error in vote:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};

exports.getVotes = async (req, res, next) => {
  try {
    // คำสั่ง SQL สำหรับการดึงข้อมูลการโหวตโดยรวม
    const query = `
      SELECT type_cal, AVG(vt_score) AS avg_score, COUNT(*) AS vote_count, COUNT(DISTINCT usr_id) AS user_count
      FROM tbl_vote
      GROUP BY type_cal
      ORDER BY avg_score DESC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      // จัดรูปแบบคะแนนเฉลี่ยให้เป็นทศนิยม 2 ตำแหน่ง
      const formattedResults = results.map((result) => ({
        ...result,
        avg_score: parseFloat(result.avg_score).toFixed(2),
      }));

      res.json({
        code: 0,
        message: "Votes retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลการโหวตสำเร็จ
        data: formattedResults,
      });
    });
  } catch (error) {
    console.error("Error in getVotes:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};

exports.checkVote = async (req, res, next) => {
  try {
    const { token_login, type_cal } = req.body; // รับค่า token_login และ type_cal จาก body ของคำขอ
    if (!token_login || !type_cal) {
      return res
        .status(400)
        .json({ message: "token_login and type_cal are required" }); // ตรวจสอบว่ามี token_login และ type_cal หรือไม่
    }

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const userQuery = "SELECT usr_id FROM tbl_users WHERE token_login = ?";
    db.query(userQuery, [token_login], (err, userResults) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      const usr_id = userResults[0]?.usr_id;

      // ตรวจสอบว่าผู้ใช้ได้โหวตแล้วหรือไม่
      const voteCheckQuery =
        "SELECT * FROM tbl_vote WHERE usr_id = ? AND type_cal = ? ORDER BY date_vote DESC LIMIT 1";
      db.query(voteCheckQuery, [usr_id, type_cal], (err, voteResults) => {
        if (err) {
          console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
          return next(err);
        }

        const now = moment().tz("Asia/Bangkok");
        let canVote = true;
        if (voteResults.length > 0) {
          const lastVoteDate = moment(voteResults[0].date_vote)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD");
          const currentDate = now.format("YYYY-MM-DD");
          if (lastVoteDate === currentDate) {
            canVote = false; // ถ้าผู้ใช้ได้โหวตแล้วในวันเดียวกัน จะไม่สามารถโหวตได้อีก
          }
        }

        res.json({ canVote }); // ส่งค่า canVote ให้หน้าเว็บเพื่อตรวจสอบ
      });
    });
  } catch (error) {
    console.error("Error in checkVote:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
