const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const db = require("./config/db");
const md5 = require("md5");

(async () => {
  // 0 * * * * ทุกๆ 1 ชั่วโมง
  // * * * * * ทุกๆ 1 นาที

  // ตั้งค่า cron job ให้รันทุกๆ 1 ชั่วโมง
  cron.schedule("0 * * * *", () => {
    let date_receive = moment.tz("Asia/Bangkok").format("YYYY-MM-DD"); // รับวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD

    const query = "SELECT `st_station_code` FROM tbl_station"; // คำสั่ง SQL เพื่อดึงรหัสสถานีจากตาราง tbl_station
    db.query(query, (err, results) => {
      for (const station of results) {
        getPM(date_receive, station.st_station_code); // เรียกใช้ฟังก์ชัน getPM สำหรับแต่ละสถานี
      }
    });
  });

  // ฟังก์ชันสำหรับดึงข้อมูล PM2.5 และ PM10
  async function getPM(date_receive, stationID, lat, long) {
    try {
      const response = await axios.get(
        `http://air4thai.com/forweb/getHistoryData.php?stationID=${stationID}&param=PM25,PM10&type=hr&sdate=${date_receive}&edate=${date_receive}&stime=00&etime=23`
      );

      // Unique data เช็ค Data ไม่ให้บันทึกซ้ำกัน
      var airt_unique = md5(stationID + date_receive);

      // Query เช็คว่ามีข้อมูล Insert แล้วหรือยัง
      let query_checkinsert =
        "SELECT st_station_code FROM tbl_air4thai WHERE airt_unique = ?";
      let values_checkinsert = [airt_unique];
      db.query(query_checkinsert, values_checkinsert, (err, result) => {
        if (result.length > 0) {
          // ถ้ามีข้อมูลแล้ว
          let query_update = `UPDATE tbl_air4thai SET airt_pm25 = ?, airt_pm10 = ? WHERE airt_unique = ?`;
          db.query(query_update, [
            response.data.stations[0].summary.PM25.average,
            response.data.stations[0].summary.PM10.average,
            airt_unique,
          ]);
          console.log("Update : " + stationID);
        } else {
          // ถ้ายังไม่มีข้อมูล
          const query_insert =
            "INSERT INTO tbl_air4thai (st_station_code, airt_pm25, airt_pm10, airt_unique, date_keep) VALUES (?, ?, ?, ?, ?)";
          const values_insert = [
            stationID,
            response.data.stations[0].summary.PM25.average,
            response.data.stations[0].summary.PM10.average,
            airt_unique,
            date_receive,
          ];
          db.query(query_insert, values_insert);
          console.log("Insert : " + stationID);
        }
      });
    } catch (error) {
      console.error("Error fetching air quality data:", error.message); // แสดงข้อผิดพลาดถ้ามีปัญหาในการดึงข้อมูลคุณภาพอากาศ
    }
  }
})();
