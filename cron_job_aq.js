const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const db = require("./config/db");
const md5 = require("md5");

(async () => {
  // ตั้งค่า cron job ให้รันทุกๆ 1 ชั่วโมง
  cron.schedule("0 * * * *", async () => {
    // Cronjob เก็บค่า
    let date_start = moment()
      .tz("Asia/Bangkok")
      .subtract(1, "days")
      .format("YYYYMMDD"); // วันที่เริ่มต้น (1 วันก่อนหน้า)
    let date_stop = moment().tz("Asia/Bangkok").format("YYYYMMDD"); // วันที่สิ้นสุด (วันปัจจุบัน)

    // ดึงข้อมูลจาก API ของ OpenAQ
    const response = await axios.get(
      `https://api.openaq.org/v2/measurements?parameter=pm10&parameter=pm25&coordinates=13.832076,100.057961&date_from=${date_start}&date_to=${date_stop}&limit=2000`,
      {
        headers: {
          "X-API-Key":
            "b47a3ff6d1cffb57336cfd1a1434aecf25bd22f67076fd931064546068d34d77",
        },
      }
    );

    // วนลูปผ่านผลลัพธ์ที่ได้จาก API และบันทึกลงฐานข้อมูล
    for (const result of response.data.results) {
      const query =
        "INSERT IGNORE INTO tbl_openaq (op_type, op_value, op_unique, date_keep) VALUES (?, ?, ?, ?)";
      let openaq_unique = md5(result.parameter + result.date.local); // สร้างค่า unique สำหรับแต่ละรายการ
      let date_keep = moment(result.date.local)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss"); // แปลงวันที่ให้เป็นรูปแบบที่ต้องการ
      const values = [result.parameter, result.value, openaq_unique, date_keep];
      console.log("Insert OpenAq");
      db.query(query, values, (err, results) => {
        console.log(err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ insert ข้อมูล
      });
    }
  });

  // ตั้งค่า cron job ให้รันทุกวันเวลา 01:00 น.
  cron.schedule("0 1 * * *", () => {
    // Cronjob ลบค่า Data เกิน 30 วัน
    const query_del = `DELETE FROM tbl_openaq WHERE created_at < CURDATE() - INTERVAL 30 DAY`;
    db.query(query_del);
  });
})();
