const cron = require("node-cron");
const moment = require("moment-timezone");
const db = require("./config/db");

(async () => {
  // ตั้งค่า cron job ให้รันทุกๆ 1 นาที
  cron.schedule("* * * * *", () => {
    console.log("Check Expired OTP");

    // คำสั่ง SQL เพื่อดึง OTP ที่หมดอายุ (สร้างมากกว่า 1 นาทีที่ผ่านมา)
    const query = `SELECT * FROM tbl_otp WHERE Createdate < NOW() - INTERVAL 1 MINUTE`;

    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return;
      }

      // วนลูปผ่านผลลัพธ์ที่ได้จากการ query
      for (const result of results) {
        // คำสั่ง SQL เพื่ออัปเดตสถานะ OTP เป็นหมดอายุ
        let query = "UPDATE tbl_otp SET isExpire = ? WHERE OtpId = ?";
        db.query(query, [1, result.OtpId], (err, results) => {
          if (err) {
            console.error("Database update error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ update ฐานข้อมูล
          }
        });
      }
    });
  });
})();
