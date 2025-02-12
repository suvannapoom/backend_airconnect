const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const db = require("./config/db");
const md5 = require("md5");

(async () => {
  // Cronjob ย้อนหลัง
  cron.schedule("* * * * *", async () => {
    // ------- Start api.weatherbit
    // เก็บทุกชั่วโมง
    let date_start_weatherbit = moment()
      .tz("Asia/Bangkok")
      .subtract(1, "days")
      .format("YYYY-MM-DD"); // ย้อนหลัง 1 วัน
    let date_stop_weatherbit = moment().tz("Asia/Bangkok").format("YYYY-MM-DD"); // วันปันจุบัน

    const response_weatherbit = await axios.get(
      `https://api.weatherbit.io/v2.0/history/airquality?lat=13.8196&lon=100.0443&start_date=${date_start_weatherbit}&end_date=${date_stop_weatherbit}&tz=local&key=3f1408eb58ca40488aea2ec72cd9bc3a`
    );

    for (const result of response_weatherbit.data.data) {
      let date_keep = moment(result.timestamp_local)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss");
      // Insert Pm25
      const query25 =
        "INSERT IGNORE INTO tbl_weatherbit (type, value, we_unique, date_keep) VALUES (?, ?, ?, ?)";
      let we_unique_25 = md5("pm25" + date_keep);
      const values25 = ["pm25", result.pm25, we_unique_25, date_keep];
      db.query(query25, values25);

      // Insert Pm10
      const query10 =
        "INSERT IGNORE INTO tbl_weatherbit (type, value, we_unique, date_keep) VALUES (?, ?, ?, ?)";
      let we_unique_10 = md5("pm10" + date_keep);
      const values10 = ["pm10", result.pm10, we_unique_10, date_keep];
      db.query(query10, values10);
    }
    // ------- End api.weatherbit

    // ------- Start api.openweathermap
    let date_start_weathermap = moment()
      .tz("Asia/Bangkok")
      .subtract(1, "days")
      .unix(); // ย้อนหลัง 1 วัน
    let date_stop_weathermap = moment().tz("Asia/Bangkok").unix(); // วันปันจุบัน
    const response_weathermap = await axios.get(
      `http://api.openweathermap.org/data/2.5/air_pollution/history?lat=13.832222&lon=100.057867&start=${date_start_weathermap}&end=${date_stop_weathermap}&appid=4c892c4886ac9c04fc4a6ab9789b263f`
    );

    for (const result of response_weathermap.data.list) {
      const date_keep = moment
        .unix(result.dt)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss");
      // Insert Pm25
      const query25 =
        "INSERT IGNORE INTO tbl_openweather (type, value, ow_unique, date_keep) VALUES (?, ?, ?, ?)";
      let ow_unique_25 = md5("pm25" + date_keep);
      const values25 = [
        "pm25",
        result.components.pm2_5,
        ow_unique_25,
        date_keep,
      ];
      db.query(query25, values25);

      // Insert Pm10
      const query10 =
        "INSERT IGNORE INTO tbl_openweather (type, value, ow_unique, date_keep) VALUES (?, ?, ?, ?)";
      let ow_unique_10 = md5("pm10" + date_keep);
      const values10 = [
        "pm10",
        result.components.pm10,
        ow_unique_10,
        date_keep,
      ];
      db.query(query10, values10);
    }
    // ------- End api.openweathermap

    // ------- Start api.air4thai
    let date_start_air4thai = moment()
      .tz("Asia/Bangkok")
      .subtract(1, "days")
      .format("YYYY-MM-DD"); // ย้อนหลัง 1 วัน
    let date_stop_air4thai = moment().tz("Asia/Bangkok").format("YYYY-MM-DD"); // วันปันจุบัน
    const response_air4thai = await axios.get(
      `http://air4thai.com/forweb/getHistoryData.php?stationID=81t&param=PM25,PM10&type=hr&sdate=${date_start_air4thai}&edate=${date_stop_air4thai}&stime=00&etime=23`
    );

    for (const result of response_air4thai.data.stations[0].data) {
      if (result.PM25 != null || result.PM25 != null) {
        const date_keep = moment(result.DATETIMEDATA)
          .tz("Asia/Bangkok")
          .format("YYYY-MM-DD HH:mm:ss");

        // Insert Pm25
        const query25 =
          "INSERT IGNORE INTO tbl_air4nkp (type, value, an_unique, date_keep) VALUES (?, ?, ?, ?)";
        let an_unique_25 = md5("pm25" + date_keep);
        const values25 = ["pm25", result.PM25, an_unique_25, date_keep];
        db.query(query25, values25);

        // Insert Pm10
        const query10 =
          "INSERT IGNORE INTO tbl_air4nkp (type, value, an_unique, date_keep) VALUES (?, ?, ?, ?)";
        let an_unique_10 = md5("pm10" + date_keep);
        const values10 = ["pm10", result.PM10, an_unique_10, date_keep];
        db.query(query10, values10);
      }
    }
    // ------- End api.air4thai
  });

  // Cronjob ล่วงหน้า
  cron.schedule("2 * * * *", async () => {
    // ทำทุกเที่ยงคืน
    // ------ Start quality
    const response_quality = await axios.get(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.800003&longitude=100.100006&current=pm10,pm2_5&hourly=pm10,pm2_5,uv_index_clear_sky&timezone=Asia%2FBangkok&past_days=31&forecast_days=3`,
      {
        headers: {
          "X-API-Key":
            "b47a3ff6d1cffb57336cfd1a1434aecf25bd22f67076fd931064546068d34d77",
        },
      }
    );

    console.log("Response from Open Meteo API:", response_quality.data);

    let result_airq = [];
    let time = response_quality.data.hourly.time.length;
    for (let i = 0; i < time; i++) {
      let date_keep = moment(response_quality.data.hourly.time[i])
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss");
      let value_air25 = response_quality.data.hourly.pm2_5[i];
      let value_air10 = response_quality.data.hourly.pm10[i];

      // pm25
      result_airq.push({
        type: "pm25",
        value: value_air25,
        date_keep: date_keep,
        aq_unique: md5(date_keep + value_air25),
      });
      // pm10
      result_airq.push({
        type: "pm10",
        value: value_air10,
        date_keep: date_keep,
        aq_unique: md5(date_keep + value_air10),
      });
    }

    console.log("Data to be inserted into tbl_airquality:", result_airq);

    const query_airq =
      "INSERT IGNORE INTO tbl_airquality (type, value, date_keep, aq_unique) VALUES ?";
    const values_air1 = result_airq.map((item) => [
      item.type,
      item.value,
      item.date_keep,
      item.aq_unique,
    ]);
    // ทำการ insert ข้อมูล
    db.query(query_airq, [values_air1], (err, results) => {
      if (err) {
        console.error("Database insert error:", err);
      } else {
        console.log("Data inserted into tbl_airquality:", results);
      }
    });
    // ------ End quality

    // ------ Start weatherbit
    const response_2_weatherbit = await axios.get(
      `https://api.weatherbit.io/v2.0/forecast/airquality?lat=13.8196&lon=100.0443&key=3f1408eb58ca40488aea2ec72cd9bc3a&days=3`
    );

    console.log("Response from Weatherbit API:", response_2_weatherbit.data);

    for (const result of response_2_weatherbit.data.data) {
      let date_keep = moment(result.timestamp_local)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss");
      // Insert Pm25
      const query25 =
        "INSERT IGNORE INTO tbl_weatherbit (type, value, we_unique, date_keep) VALUES (?, ?, ?, ?)";
      let we_unique_25 = md5("pm25" + date_keep);
      const values25 = ["pm25", result.pm25, we_unique_25, date_keep];
      db.query(query25, values25, (err, results) => {
        if (err) {
          console.error("Database insert error:", err);
        } else {
          console.log("Data inserted into tbl_weatherbit (pm25):", results);
        }
      });

      // Insert Pm10
      const query10 =
        "INSERT IGNORE INTO tbl_weatherbit (type, value, we_unique, date_keep) VALUES (?, ?, ?, ?)";
      let we_unique_10 = md5("pm10" + date_keep);
      const values10 = ["pm10", result.pm10, we_unique_10, date_keep];
      db.query(query10, values10, (err, results) => {
        if (err) {
          console.error("Database insert error:", err);
        } else {
          console.log("Data inserted into tbl_weatherbit (pm10):", results);
        }
      });
    }
    // ------ End weatherbit

    // ------ Start openweathermap
    let date_start_3_openweathermap = moment().tz("Asia/Bangkok").unix(); // วันปัจจุบัน
    let date_stop_3_openweathermap = moment()
      .tz("Asia/Bangkok")
      .add(3, "days")
      .unix(); // 3 วันข้างหน้า

    const response_3_date_stop_3_openweathermap = await axios.get(
      `http://api.openweathermap.org/data/2.5/air_pollution/history?lat=13.832222&lon=100.057867&start=${date_start_3_openweathermap}&end=${date_stop_3_openweathermap}&appid=4c892c4886ac9c04fc4a6ab9789b263f`
    );

    console.log(
      "Response from OpenWeatherMap API:",
      response_3_date_stop_3_openweathermap.data
    );

    for (const result of response_3_date_stop_3_openweathermap.data.list) {
      const date_keep = moment
        .unix(result.dt)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD HH:mm:ss");
      // Insert Pm25
      const query25 =
        "INSERT IGNORE INTO tbl_openweather (type, value, ow_unique, date_keep) VALUES (?, ?, ?, ?)";
      let ow_unique_25 = md5("pm25" + date_keep);
      const values25 = [
        "pm25",
        result.components.pm2_5,
        ow_unique_25,
        date_keep,
      ];
      db.query(query25, values25, (err, results) => {
        if (err) {
          console.error("Database insert error:", err);
        } else {
          console.log("Data inserted into tbl_openweather (pm25):", results);
        }
      });

      // Insert Pm10
      const query10 =
        "INSERT IGNORE INTO tbl_openweather (type, value, ow_unique, date_keep) VALUES (?, ?, ?, ?)";
      let ow_unique_10 = md5("pm10" + date_keep);
      const values10 = [
        "pm10",
        result.components.pm10,
        ow_unique_10,
        date_keep,
      ];
      db.query(query10, values10, (err, results) => {
        if (err) {
          console.error("Database insert error:", err);
        } else {
          console.log("Data inserted into tbl_openweather (pm10):", results);
        }
      });
    }
    // ------ End openweathermap
  });

  // ลบข้อมูลที่เกิน 30 วัน
  cron.schedule("0 0 * * *", async () => {
    // tbl_airquality
    const query_airquality = `DELETE FROM tbl_airquality WHERE data_keep < NOW() - INTERVAL 30 DAY`;
    db.query(query_airquality);
    // tbl_openaq
    const query_openaq = `DELETE FROM tbl_openaq WHERE data_keep < NOW() - INTERVAL 30 DAY`;
    db.query(query_openaq);
    // tbl_openaq
    const query_weatherbit = `DELETE FROM tbl_weatherbit WHERE data_keep < NOW() - INTERVAL 30 DAY`;
    db.query(query_weatherbit);
    // tbl_air4nkp
    const query_air4nkp = `DELETE FROM tbl_air4nkp WHERE data_keep < NOW() - INTERVAL 30 DAY`;
    db.query(query_air4nkp);
  });
})();
