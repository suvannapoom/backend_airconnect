const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment");
const db = require("./config/db"); // โมดูลสำหรับการเชื่อมต่อและทำงานกับฐานข้อมูล MySQL

async function fetchAndStoreOpenAQData() {
  try {
    const dateData = {
      from: "2024-11-01",
      to: "2024-11-02",
    };

    // ดึงข้อมูลจาก API ของ OpenAQ
    const response = await axios.get(
      `https://api.openaq.org/v2/measurements?coordinates=13.832076,100.057961&date_from=${dateData.from}&date_to=${dateData.to}&parameter=pm25&limit=2000`,
      {
        headers: {
          "X-API-Key":
            "b47a3ff6d1cffb57336cfd1a1434aecf25bd22f67076fd931064546068d34d77",
        },
      }
    );

    const openAQData = response.data.results;
    console.log(openAQData);
    if (!openAQData || openAQData.length === 0) {
      console.error("data not found");
      return;
    }

    // เก็บข้อมูลลงในฐานข้อมูล
    const insertQuery = `
      INSERT INTO tbl_openaq (aq_location, aq_value, aq_datetime)
      VALUES (?, ?, ?)
    `;

    openAQData.forEach((data) => {
      const {
        location: aq_location,
        value: aq_value,
        date: aq_datetime,
      } = data;
      db.query(insertQuery, [aq_location, aq_value, aq_datetime.utc], (err) => {
        if (err) {
          console.error("Database insert error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ insert ข้อมูล
        }
      });
    });

    console.log("OpenAQ data fetched and stored successfully");
  } catch (error) {
    console.error("Error in fetchAndStoreOpenAQData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในการดึงข้อมูลหรือบันทึกข้อมูล
  }
}

// รันฟังก์ชันทุกวันเวลา 00:00
cron.schedule("0 * * * *", fetchAndStoreOpenAQData);
