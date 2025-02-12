const axios = require("axios");
const moment = require("moment");
const createError = require("../utils/createError");
const db = require("../config/db");
exports.getDustList = async (req, res, next) => {
  try {
    // ดึงข้อมูลจาก API ของ Air4Thai
    const response = await axios.get(
      "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php"
    );

    const dustData = response.data;

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (!dustData) {
      return next(createError("data not found", 400)); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้าไม่พบข้อมูล
    }

    // ส่งข้อมูลฝุ่นกลับไปยัง client
    res.json({ dust: dustData });
  } catch (error) {
    next(error); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการดึงข้อมูล
  }
};
exports.getDataDust = async (req, res, next) => {
  try {
    // กำหนดช่วงวันที่สำหรับดึงข้อมูล
    const dateData = {
      from: moment().subtract(1, "days").format("L"), // วันที่เริ่มต้น (1 วันก่อนหน้า)
      to: moment().add(2, "days").format("L"), // วันที่สิ้นสุด (2 วันข้างหน้า)
    };

    // ดึงข้อมูลจาก API ของ OpenAQ
    const response = await axios.get(
      `https://api.openaq.org/v1/measurements?parameter=pm25&date_from=${dateData.from}&date_to=${dateData.to}&location_id=225587&limit=2000`,
      {
        headers: {
          "X-API-Key":
            "b47a3ff6d1cffb57336cfd1a1434aecf25bd22f67076fd931064546068d34d77",
        },
      }
    );

    const dustData = response.data;
    console.log(dustData);

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (!dustData) {
      return next(createError("data not found", 400)); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้าไม่พบข้อมูล
    }

    // ส่งข้อมูลฝุ่นกลับไปยัง client
    res.json({ dust: dustData });
  } catch (error) {
    next(error); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการดึงข้อมูล
  }
};
exports.favoritelist = async (req, res, next) => {
  try {
    const { email } = req.body;

    // ตรวจสอบว่ามีข้อมูลนี้อยู่ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_userfav WHERE userfemail = ?";
    db.query(query, [email], async (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Favorite not found" });
      } else {
        res.json({ favorite: results });
      }
    });
  } catch (error) {
    next(error);
  }
};
exports.favoriteadd = async (req, res, next) => {
  try {
    const { userfemail, stationID } = req.body;

    // ตรวจสอบว่ามีข้อมูลนี้อยู่ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_userfav WHERE userfemail = ? AND stationID = ?";
    db.query(query, [userfemail, stationID], async (err, results) => {
      if (err) {
        return next(err); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการ query ฐานข้อมูล
      }

      if (results.length === 0) {
        // เพิ่มข้อมูลใหม่ในฐานข้อมูล
        const insertQuery =
          "INSERT INTO tbl_userfav (userfemail, stationID) VALUES (?, ?)";
        db.query(insertQuery, [userfemail, stationID], (err, results) => {
          if (err) {
            return next(err); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการ insert ข้อมูล
          }
          res.json({ message: "Favorite added successfully" }); // ส่ง response กลับไปยัง client ว่าเพิ่มรายการโปรดสำเร็จ
        });
      } else {
        return res.status(401).json({ message: "Favorite already exists" }); // ส่ง response กลับไปยัง client ว่ารายการโปรดมีอยู่แล้ว
      }
    });
  } catch (error) {
    next(error); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในกระบวนการใดๆ
  }
};

exports.favoriteremove = async (req, res, next) => {
  try {
    const { userfemail, stationID } = req.body;

    // ตรวจสอบว่ามีข้อมูลนี้อยู่ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_userfav WHERE userfemail = ? AND stationID = ?";
    db.query(query, [userfemail, stationID], async (err, results) => {
      if (err) {
        return next(err); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการ query ฐานข้อมูล
      }

      if (results.length > 0) {
        // ลบข้อมูลออกจากฐานข้อมูล
        const deleteQuery =
          "DELETE FROM tbl_userfav WHERE userfemail = ? AND stationID = ?";
        db.query(deleteQuery, [userfemail, stationID], (err, results) => {
          if (err) {
            return next(err); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในการ delete ข้อมูล
          }
          res.json({ message: "Favorite removed successfully" }); // ส่ง response กลับไปยัง client ว่าลบรายการโปรดสำเร็จ
        });
      } else {
        return res.status(404).json({ message: "Favorite not found" }); // ส่ง response กลับไปยัง client ว่าไม่พบรายการโปรด
      }
    });
  } catch (error) {
    next(error); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้ามีปัญหาในกระบวนการใดๆ
  }
};

exports.fetchAndStoreDustData = async (req, res, next) => {
  try {
    // กำหนดช่วงวันที่สำหรับดึงข้อมูล
    const dateData = {
      from: moment().subtract(7, "days").format("L"), // วันที่เริ่มต้น (7 วันก่อนหน้า)
      to: moment().add(1, "days").format("L"), // วันที่สิ้นสุด (1 วันข้างหน้า)
    };

    // ดึงข้อมูลจาก API ของ OpenAQ
    const response = await axios.get(
      `https://api.openaq.org/v1/measurements?parameter=pm25&date_from=${dateData.from}&date_to=${dateData.to}&location_id=225587&limit=2000`,
      {
        headers: {
          "X-API-Key":
            "b47a3ff6d1cffb57336cfd1a1434aecf25bd22f67076fd931064546068d34d77",
        },
      }
    );

    const dustData = response.data.results;
    console.log(dustData);
    if (!dustData || dustData.length === 0) {
      return next(createError("data not found", 400)); // ส่งข้อผิดพลาดกลับไปยัง middleware ถ้าไม่พบข้อมูล
    }

    // เก็บข้อมูลลงในฐานข้อมูล
    const insertQuery = `
      INSERT INTO tbl_dustdata (location, value, date_utc)
      VALUES (?, ?, ?)
    `;

    dustData.forEach((data) => {
      const { location, value, date: date_utc } = data;
      db.query(insertQuery, [location, value, date_utc], (err) => {
        if (err) {
          console.error("Database insert error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ insert ข้อมูล
          return next(err);
        }
      });
    });

    res.json({ message: "Dust data fetched and stored successfully" }); // ส่ง response กลับไปยัง client ว่าดึงและเก็บข้อมูลฝุ่นสำเร็จ
  } catch (error) {
    console.error("Error in fetchAndStoreDustData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.getAir4ThaiData = async (req, res, next) => {
  try {
    const query = `
      SELECT
        air4.airt_id,
        air4.st_station_code,
        air4.airt_pm25,
        air4.airt_pm10,
        air4.create_date,
        station.st_name AS station_name,
        station.lat,
        station.long
      FROM
        tbl_air4thai air4
      LEFT JOIN
        tbl_station station ON air4.st_station_code = station.st_station_code
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "No data found" }); // ส่ง response กลับไปยัง client ว่าไม่พบข้อมูล
      }

      res.json({
        code: 0,
        message: "Data retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลสำเร็จ
        data: results,
      });
    });
  } catch (error) {
    console.error("Error in getAir4ThaiData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};

exports.getProvincesData = async (req, res, next) => {
  try {
    const query = "SELECT pv_id, pv_name FROM tbl_provinces";
    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "No data found" }); // ส่ง response กลับไปยัง client ว่าไม่พบข้อมูล
      }

      res.json({
        code: 0,
        message: "Data retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลสำเร็จ
        data: results,
      });
    });
  } catch (error) {
    console.error("Error in getProvincesData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};

exports.getAirQualityByProvince = async (req, res, next) => {
  try {
    const { pv_id } = req.params; // รับค่า pv_id จาก params
    const query = `
      SELECT
        air4.airt_id,
        air4.st_station_code,
        air4.airt_pm25,
        air4.airt_pm10,
        air4.create_date,
        station.st_name,
        station.lat,
        station.long
      FROM
        tbl_provinces province
      LEFT JOIN
        tbl_station station ON province.pv_id = station.pv_id
      LEFT JOIN
        tbl_air4thai air4 ON station.st_station_code = air4.st_station_code
      WHERE
        province.pv_id = ?
        AND DATE(air4.date_keep) = CURDATE()
    `;
    db.query(query, [pv_id], (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      res.json({
        code: 0,
        message: "Data retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลสำเร็จ
        data: results,
      });
    });
  } catch (error) {
    console.error("Error in getAirQualityByProvince:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { token_login, st_station_code } = req.body; // รับค่า token_login และ st_station_code จาก body ของคำขอ
    console.log(token_login, st_station_code);
    if (!token_login || !st_station_code) {
      return res
        .status(400)
        .json({ message: "token_login and st_station_code are required" });
    }

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const userQuery = "SELECT usr_id FROM tbl_users WHERE token_login = ?";
    db.query(userQuery, [token_login], (err, userResults) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      const usr_id = userResults[0].usr_id;

      // ตรวจสอบว่ามีการติดตามนี้อยู่ในฐานข้อมูลหรือไม่
      const favoriteQuery =
        "SELECT * FROM tbl_favorite WHERE usr_id = ? AND st_station_code = ?";
      db.query(
        favoriteQuery,
        [usr_id, st_station_code],
        (err, favoriteResults) => {
          if (favoriteResults.length > 0) {
            // ถ้ามีข้อมูลอยู่แล้ว ให้ลบข้อมูล
            const deleteQuery =
              "DELETE FROM tbl_favorite WHERE usr_id = ? AND st_station_code = ?";
            db.query(deleteQuery, [usr_id, st_station_code], (err) => {
              if (err) {
                console.error("Database delete error:", err);
                return next(err);
              }

              res.json({ message: "Favorite removed successfully" });
            });
          } else {
            // ถ้าไม่มีข้อมูล ให้เพิ่มข้อมูลใหม่
            const insertQuery =
              "INSERT INTO tbl_favorite (usr_id, st_station_code) VALUES (?, ?)";
            db.query(insertQuery, [usr_id, st_station_code], (err) => {
              console.log(err);

              res.json({ message: "Favorite added successfully" });
            });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error in toggleFavorite:", error);
    next(error);
  }
};
exports.getFavorites = async (req, res, next) => {
  try {
    const { token_login } = req.body; // รับค่า token_login จาก body ของคำขอ

    if (!token_login) {
      return res.status(400).json({ message: "token_login is required" });
    }

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const userQuery = "SELECT usr_id FROM tbl_users WHERE token_login = ?";
    db.query(userQuery, [token_login], (err, userResults) => {
      console.log(userResults);
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      if (userResults.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const usr_id = userResults[0].usr_id;

      // ดึงข้อมูลที่ได้ติดตามจากฐานข้อมูล
      const favoriteQuery = `
SELECT
    air4.airt_id,
    air4.st_station_code,
    air4.airt_pm25,
    air4.airt_pm10,
    air4.create_date,
    station.st_name

FROM
    tbl_favorite favorite
LEFT JOIN
    tbl_air4thai air4 ON favorite.st_station_code = air4.st_station_code
LEFT JOIN
    tbl_station station ON air4.st_station_code = station.st_station_code
WHERE
    favorite.usr_id = ?
    AND DATE(air4.date_keep) = CURDATE()
      `;
      db.query(favoriteQuery, [usr_id], (err, favoriteResults) => {
        if (err) {
          console.error("Database query error:", err);
          return next(err);
        }

        res.json({
          code: 0,
          message: "Favorites retrieved successfully",
          data: favoriteResults,
        });
      });
    });
  } catch (error) {
    console.error("Error in getFavorites:", error);
    next(error);
  }
};
exports.Databkk = async (req, res, next) => {
  try {
    const query = `
      SELECT
        air4.airt_id,
        air4.st_station_code,
        air4.airt_pm25,
        air4.airt_pm10,
        air4.create_date,
        station.st_name,
        station.lat,
        station.long
      FROM
        tbl_air4thai air4
      LEFT JOIN
        tbl_station station ON air4.st_station_code = station.st_station_code
      WHERE
        station.pv_id = 1
        AND DATE(air4.date_keep) = CURDATE()
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      res.json({
        code: 0,
        message: "Data retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลสำเร็จ
        data: results,
      });
    });
  } catch (error) {
    console.error("Error in getAir4ThaiData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.searchOpenAQData = async (req, res, next) => {
  try {
    const { date_start, date_stop, type } = req.body;
    // Log ค่าที่ได้รับจากคำขอ
    console.log("Received request:", { date_start, date_stop, type });

    // ตรวจสอบว่ามีค่า date_start, date_stop, และ type หรือไม่
    if (!date_start || !date_stop || !type) {
      return res
        .status(400)
        .json({ message: "date_start, date_stop, and type are required" });
    }

    // คำสั่ง SQL เพื่อดึงข้อมูลจากตาราง tbl_openaq
    const query = `
      SELECT \`date_keep\`, \`op_type\`, \`op_value\`
      FROM tbl_openaq
      WHERE date_keep BETWEEN ? AND ?
      AND op_type IN (?)
    `;
    db.query(
      query,
      [
        date_start + ":00",
        date_stop + ":00",
        type.split(",").map((item) => item.trim()),
      ],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
          return next(err);
        }

        // Log ผลลัพธ์ที่ได้รับจากฐานข้อมูล
        console.log("Database results:", results);

        // แยกข้อมูล PM2.5
        let pm25 = results.filter((item) => item.op_type == "pm25");
        // 1. หาค่ามากสุด (Maximum)
        const maxValuePM25 =
          pm25.length > 0 ? Math.max(...pm25.map((item) => item.op_value)) : 0;
        // 2. หาค่าน้อยสุด (Minimum)
        const minValuePM25 =
          pm25.length > 0 ? Math.min(...pm25.map((item) => item.op_value)) : 0;
        // 3. หาค่าเฉลี่ย (Average)
        const averageValuePM25 =
          pm25.length > 0
            ? pm25
                .map((item) => parseFloat(item.op_value))
                .filter((value) => !isNaN(value))
                .reduce((sum, value) => sum + value, 0) / pm25.length
            : 0;

        // แยกข้อมูล PM10
        let pm10 = results.filter((item) => item.op_type == "pm10");
        // 1. หาค่ามากสุด (Maximum)
        const maxValuePM10 =
          pm10.length > 0 ? Math.max(...pm10.map((item) => item.op_value)) : 0;
        // 2. หาค่าน้อยสุด (Minimum)
        const minValuePM10 =
          pm10.length > 0 ? Math.min(...pm10.map((item) => item.op_value)) : 0;
        // 3. หาค่าเฉลี่ย (Average)
        const averageValuePM10 =
          pm10.length > 0
            ? pm10
                .map((item) => parseFloat(item.op_value))
                .filter((value) => !isNaN(value))
                .reduce((sum, value) => sum + value, 0) / pm10.length
            : 0;

        // การแสดงผลตาราง ของแต่ละช่วงเวลา
        let date = [];

        results.forEach((item) => {
          let date_keep = moment(item.date_keep)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
          console.log(date_keep);
          // เก็บข้อมูลวันเวลาที่มีทั้งหมด เพื่อเป็นรูปแบบในการเอา ข้อมูลมา pm25 และ pm10 มาอัพเดทตามวันเวลา
          date.push({
            date_keep: date_keep,
            pm25: "",
            pm10: "",
          });
        });

        // ลบข้อมูลวันที่ซ้ำกัน
        let convertData = date.reduce((acc, current) => {
          // ตรวจสอบว่า date_keep ซ้ำหรือไม่
          if (!acc.some((item) => item.date_keep === current.date_keep)) {
            acc.push(current); // ถ้าไม่ซ้ำให้เพิ่มลงใน array
          }
          return acc;
        }, []);

        // อัพเดทข้อมูล pm25 และ pm10 ตามวันเวลา
        convertData.forEach((item) => {
          let date_keep = moment(item.date_keep)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
          let matchingPm25 = pm25.find(
            (pm25Item) =>
              moment(pm25Item.date_keep)
                .tz("Asia/Bangkok")
                .format("YYYY-MM-DD HH:mm:ss") === item.date_keep
          );
          if (matchingPm25) {
            item.pm25 = matchingPm25.op_value;
          }

          let matchingPm10 = pm10.find(
            (pm10Item) =>
              moment(pm10Item.date_keep)
                .tz("Asia/Bangkok")
                .format("YYYY-MM-DD HH:mm:ss") === item.date_keep
          );
          if (matchingPm10) {
            item.pm10 = matchingPm10.op_value;
          }
        });

        // เรียงข้อมูลตามวันเวลา
        let resultTable = convertData.sort((a, b) => {
          return moment(a.date_keep).isBefore(moment(b.date_keep)) ? 1 : -1;
        });

        // ส่ง response กลับไปยัง client พร้อมข้อมูลที่คำนวณแล้ว
        return res.json({
          code: 0,
          res: {
            pm25: {
              max: Number(maxValuePM25.toFixed(2)),
              min: Number(minValuePM25.toFixed(2)),
              avg: Number(averageValuePM25.toFixed(2)),
            },
            pm10: {
              max: Number(maxValuePM10.toFixed(2)),
              min: Number(minValuePM10.toFixed(2)),
              avg: Number(averageValuePM10.toFixed(2)),
            },
            result: resultTable,
          },
        });
      }
    );
  } catch (error) {
    console.error("Error in searchOpenAQData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.getGraphData = async (req, res, next) => {
  try {
    let date_start = moment()
      .tz("Asia/Bangkok")
      .subtract(7, "days")
      .format("YYYY-MM-DD"); // ย้อนหลัง 7 วัน
    let date_stop = moment()
      .tz("Asia/Bangkok")
      .add(3, "days")
      .format("YYYY-MM-DD"); // ล่วงหน้า 3 วัน

    // ดึงข้อมูลจากตาราง tbl_airquality
    let result_airquality = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_airquality WHERE date_keep BETWEEN ? AND ?ORDER BY date_keep ASC`;
      db.query(query, [date_start, date_stop], (err, results) => {
        if (err) {
          return reject(err);
        }
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"),
            ...rest,
          };
        });
        resolve(transformedData);
      });
    });

    // ดึงข้อมูลจากตาราง tbl_openweather
    let result_openaq = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_openweather WHERE date_keep BETWEEN ? AND ?ORDER BY date_keep ASC`;
      db.query(query, [date_start, date_stop], (err, results) => {
        if (err) {
          return reject(err);
        }
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"),
            ...rest,
          };
        });
        resolve(transformedData);
      });
    });

    // ดึงข้อมูลจากตาราง tbl_weatherbit
    let result_weatherbit = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_weatherbit WHERE date_keep BETWEEN ? AND ?ORDER BY date_keep ASC`;
      db.query(query, [date_start, date_stop], (err, results) => {
        if (err) {
          return reject(err);
        }
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"),
            ...rest,
          };
        });
        resolve(transformedData);
      });
    });

    // ดึงข้อมูลจากตาราง tbl_air4nkp
    let result_air4 = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_air4nkp WHERE date_keep BETWEEN ? AND ?ORDER BY date_keep ASC`;
      db.query(query, [date_start, date_stop], (err, results) => {
        if (err) {
          return reject(err);
        }
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"),
            ...rest,
          };
        });
        resolve(transformedData);
      });
    });

    return res.json({
      code: 0,
      res: {
        pm25: {
          result_airquality: result_airquality.filter(
            (item) => item.type === "pm25"
          ),
          result_openaq: result_openaq.filter((item) => item.type === "pm25"),
          result_weatherbit: result_weatherbit.filter(
            (item) => item.type === "pm25"
          ),
          result_air4: result_air4.filter((item) => item.type === "pm25"),
        },
        pm10: {
          result_airquality: result_airquality.filter(
            (item) => item.type === "pm10"
          ),
          result_openaq: result_openaq.filter((item) => item.type === "pm10"),
          result_weatherbit: result_weatherbit.filter(
            (item) => item.type === "pm10"
          ),
          result_air4: result_air4.filter((item) => item.type === "pm10"),
        },
      },
    });
  } catch (error) {
    console.error("Error in getGraphData:", error);
    next(error);
  }
};

exports.getFilteredData = async (req, res, next) => {
  try {
    // แสดงค่าที่รับจากคำขอ
    console.log("Received data from frontend:", req.body);

    const { selectedSources, days, pollutionType } = req.body; // รับค่าจาก body ของคำขอ

    // ตรวจสอบว่ามีค่า selectedSources, days, และ pollutionType หรือไม่
    if (!selectedSources || !days || !pollutionType) {
      return res
        .status(400)
        .json({ message: "sources, days, and pollutionType are required" });
    }

    // กำหนดช่วงวันที่สำหรับดึงข้อมูล
    let date_start = moment().tz("Asia/Bangkok").format("YYYY-MM-DD");
    let date_stop = moment()
      .tz("Asia/Bangkok")
      .add(days, "days")
      .format("YYYY-MM-DD");

    var result_airquality = [];
    if (selectedSources.includes("openmeteo")) {
      // ดึงข้อมูลจาก tbl_airquality
      result_airquality = await new Promise((resolve, reject) => {
        const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_airquality WHERE date_keep BETWEEN ? AND ? AND type = ? ORDER BY date_keep ASC`;
        db.query(
          query,
          [date_start, date_stop, pollutionType], // แก้ไขชื่อเป็น pollutionType
          (err, results) => {
            if (err) {
              return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
            }
            const transformedData = results.map((item) => {
              const { date_keep, ...rest } = item;
              return {
                date_keep: moment(item.date_keep)
                  .tz("Asia/Bangkok")
                  .format("YYYY-MM-DD HH:mm:ss"),
                api_name: "OpenMeteo",
                ...rest,
              };
            });
            resolve(transformedData);
          }
        );
      });
    }

    var result_openweather = [];
    if (selectedSources.includes("openweather")) {
      // ดึงข้อมูลจาก tbl_openweather
      result_openweather = await new Promise((resolve, reject) => {
        const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_openweather WHERE date_keep BETWEEN ? AND ? AND type = ? ORDER BY date_keep ASC`;
        db.query(
          query,
          [date_start, date_stop, pollutionType], // แก้ไขชื่อเป็น pollutionType
          (err, results) => {
            if (err) {
              return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
            }
            const transformedData = results.map((item) => {
              const { date_keep, ...rest } = item;
              return {
                date_keep: moment(item.date_keep)
                  .tz("Asia/Bangkok")
                  .format("YYYY-MM-DD HH:mm:ss"),
                api_name: "OpenWeather",
                ...rest,
              };
            });
            resolve(transformedData);
          }
        );
      });
    }

    var result_weatherbit = [];
    if (selectedSources.includes("weatherbit")) {
      // ดึงข้อมูลจาก tbl_weatherbit
      result_weatherbit = await new Promise((resolve, reject) => {
        const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_weatherbit WHERE date_keep BETWEEN ? AND ? AND type = ? ORDER BY date_keep ASC`;
        db.query(
          query,
          [date_start, date_stop, pollutionType], // แก้ไขชื่อเป็น pollutionType
          (err, results) => {
            if (err) {
              return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
            }
            const transformedData = results.map((item) => {
              const { date_keep, ...rest } = item;
              return {
                date_keep: moment(item.date_keep)
                  .tz("Asia/Bangkok")
                  .format("YYYY-MM-DD HH:mm:ss"),
                api_name: "WeatherBit",
                ...rest,
              };
            });
            resolve(transformedData);
          }
        );
      });
    }

    // รวมข้อมูลจากทุกแหล่งที่มา
    let result = result_weatherbit.concat(
      result_airquality.concat(result_openweather)
    );
    // เรียงข้อมูลตามวันเวลา
    const sortedDataASC = result.sort(
      (a, b) => new Date(a.date_keep) - new Date(b.date_keep)
    );

    // ส่ง response กลับไปยัง client พร้อมข้อมูลที่กรองและเรียงแล้ว
    return res.json({
      code: 0,
      message: "success",
      res: sortedDataASC,
    });
  } catch (error) {
    console.error("Error in getFilteredData:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.calculateMetrics = async (req, res, next) => {
  try {
    // ดึงข้อมูลจาก Air4Thai
    var result_air4nkp = await new Promise((resolve, reject) => {
      const query = `
    SELECT \`date_keep\`, \`type\`, \`value\`
    FROM tbl_air4nkp
    WHERE \`date_keep\` BETWEEN CURRENT_DATE - INTERVAL 30 DAY AND CURRENT_DATE
  `;
      db.query(query, (err, results) => {
        if (err) {
          return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
        }
        // แปลงข้อมูลที่ได้จากฐานข้อมูล
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"), // แปลงวันที่ให้เป็นรูปแบบที่ต้องการ
            api_name: "OpenMeteo", // เพิ่มชื่อ API
            ...rest,
          };
        });
        resolve(transformedData); // ส่งข้อมูลที่แปลงแล้วกลับไปยัง promise
      });
    });

    // ดึงข้อมูลจาก AirQuality
    var result_airquality = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_airquality WHERE date_keep > CURDATE() - INTERVAL 1 DAY`;
      db.query(query, (err, results) => {
        if (err) {
          return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
        }
        // แปลงข้อมูลที่ได้จากฐานข้อมูล
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"), // แปลงวันที่ให้เป็นรูปแบบที่ต้องการ
            api_name: "OpenMeteo", // เพิ่มชื่อ API
            ...rest,
          };
        });
        resolve(transformedData); // ส่งข้อมูลที่แปลงแล้วกลับไปยัง promise
      });
    });

    // ดึงข้อมูลจาก OpenWeather
    var result_openweather = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_openweather WHERE date_keep > CURDATE() - INTERVAL 1 DAY`;
      db.query(query, (err, results) => {
        if (err) {
          return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
        }
        // แปลงข้อมูลที่ได้จากฐานข้อมูล
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"), // แปลงวันที่ให้เป็นรูปแบบที่ต้องการ
            api_name: "OpenWeather", // เพิ่มชื่อ API
            ...rest,
          };
        });
        resolve(transformedData); // ส่งข้อมูลที่แปลงแล้วกลับไปยัง promise
      });
    });

    // ดึงข้อมูลจาก WeatherBit
    var result_weatherbit = await new Promise((resolve, reject) => {
      const query = `SELECT \`date_keep\`, \`type\`, \`value\` FROM tbl_weatherbit WHERE date_keep > CURDATE() - INTERVAL 1 DAY`;
      db.query(query, (err, results) => {
        if (err) {
          return reject(err); // ส่งข้อผิดพลาดกลับไปยัง promise ถ้ามีปัญหาในการ query ฐานข้อมูล
        }
        // แปลงข้อมูลที่ได้จากฐานข้อมูล
        const transformedData = results.map((item) => {
          const { date_keep, ...rest } = item;
          return {
            date_keep: moment(item.date_keep)
              .tz("Asia/Bangkok")
              .format("YYYY-MM-DD HH:mm:ss"), // แปลงวันที่ให้เป็นรูปแบบที่ต้องการ
            api_name: "WeatherBit", // เพิ่มชื่อ API
            ...rest,
          };
        });
        resolve(transformedData); // ส่งข้อมูลที่แปลงแล้วกลับไปยัง promise
      });
    });

    // ---------------------------- Process Calculate ----------------------------
    // คำนวนค่า MAE
    async function CalculateMAE(
      actualData,
      result_openweather,
      result_weatherbit,
      result_airquality
    ) {
      //  เป็นส่วนของการ กรอง ข้อมูล เฉพาะ เวลา ที่มีเหมือนกันของ 3 api
      const commonInA = result_openweather.filter(
        (itemA) =>
          result_weatherbit.some(
            (itemB) =>
              itemB.date_keep.split(" ")[1] === itemA.date_keep.split(" ")[1]
          ) &&
          result_airquality.some(
            (itemC) =>
              itemC.date_keep.split(" ")[1] === itemA.date_keep.split(" ")[1]
          )
      );
      const commonInB = result_weatherbit.filter(
        (itemB) =>
          result_openweather.some(
            (itemA) =>
              itemA.date_keep.split(" ")[1] === itemB.date_keep.split(" ")[1]
          ) &&
          result_airquality.some(
            (itemC) =>
              itemC.date_keep.split(" ")[1] === itemB.date_keep.split(" ")[1]
          )
      );
      const commonInC = result_airquality.filter(
        (itemC) =>
          result_openweather.some(
            (itemA) =>
              itemA.date_keep.split(" ")[1] === itemC.date_keep.split(" ")[1]
          ) &&
          result_weatherbit.some(
            (itemB) =>
              itemB.date_keep.split(" ")[1] === itemC.date_keep.split(" ")[1]
          )
      );

      // PM25
      let totalMath_pOpenwetherPM25 = 0;
      let count_pOpenwetherPM25 = 0;
      const pOpenwetherPM25 = new Map();
      commonInA
        .filter((item) => item.type == "pm25")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pOpenwetherPM25.set(`${hourKey}`, predictedValue);
          }
        });

      let totalMath_pWeatherbitPM25 = 0;
      let count_pWeatherbitPM25 = 0;
      const pWeatherbitPM25 = new Map();
      commonInB
        .filter((item) => item.type == "pm25")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pWeatherbitPM25.set(`${hourKey}`, predictedValue);
          }
        });

      let totalMath_pAirqualityPM25 = 0;
      let count_pAirqualityPM25 = 0;
      const pAirqualityPM25 = new Map();
      commonInC
        .filter((item) => item.type == "pm25")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pAirqualityPM25.set(`${hourKey}`, predictedValue);
          }
        });

      actualData
        .filter((item) => item.type == "pm25")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1]; // ใช้เวลา 'HH:00' เป็น key
          const key = `${hourKey}`;
          const actualValue = parseFloat(item.value);

          if (!isNaN(actualValue) && pWeatherbitPM25.has(key)) {
            const predictedValue = pWeatherbitPM25.get(key);
            totalMath_pOpenwetherPM25 += Math.abs(predictedValue - actualValue);
            count_pOpenwetherPM25++;
          }

          if (!isNaN(actualValue) && pWeatherbitPM25.has(key)) {
            const predictedValue = pWeatherbitPM25.get(key);
            totalMath_pWeatherbitPM25 += Math.abs(predictedValue - actualValue);
            count_pWeatherbitPM25++;
          }

          if (!isNaN(actualValue) && pAirqualityPM25.has(key)) {
            const predictedValue = pAirqualityPM25.get(key);
            totalMath_pAirqualityPM25 += Math.abs(predictedValue - actualValue);
            count_pAirqualityPM25++;
          }
        });

      let mea_OpenwethePM25 =
        count_pOpenwetherPM25 > 0
          ? totalMath_pOpenwetherPM25 / count_pOpenwetherPM25
          : null;
      let mea_WeatherbitPM25 =
        count_pWeatherbitPM25 > 0
          ? totalMath_pWeatherbitPM25 / count_pWeatherbitPM25
          : null;
      let mea_AirqualityPM25 =
        count_pAirqualityPM25 > 0
          ? totalMath_pAirqualityPM25 / count_pAirqualityPM25
          : null;

      // PM10
      let totalMath_pOpenwetherPM10 = 0;
      let count_pOpenwetherPM10 = 0;
      const pOpenwetherPM10 = new Map();
      commonInA
        .filter((item) => item.type == "pm10")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pOpenwetherPM10.set(`${hourKey}`, predictedValue);
          }
        });

      let totalMath_pWeatherbitPM10 = 0;
      let count_pWeatherbitPM10 = 0;
      const pWeatherbitPM10 = new Map();
      commonInB
        .filter((item) => item.type == "pm10")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pWeatherbitPM10.set(`${hourKey}`, predictedValue);
          }
        });

      let totalMath_pAirqualityPM10 = 0;
      let count_pAirqualityPM10 = 0;
      const pAirqualityPM10 = new Map();
      commonInC
        .filter((item) => item.type == "pm10")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1];
          const predictedValue = parseFloat(item.value);
          if (!isNaN(predictedValue)) {
            pAirqualityPM10.set(`${hourKey}`, predictedValue);
          }
        });

      actualData
        .filter((item) => item.type == "pm10")
        .forEach((item) => {
          const hourKey = item.date_keep.split(" ")[1]; // ใช้เวลา 'HH:00' เป็น key
          const key = `${hourKey}`;
          const actualValue = parseFloat(item.value);

          if (!isNaN(actualValue) && pOpenwetherPM10.has(key)) {
            const predictedValue = pOpenwetherPM10.get(key);
            totalMath_pOpenwetherPM10 += Math.abs(predictedValue - actualValue);
            count_pOpenwetherPM10++;
          }

          if (!isNaN(actualValue) && pWeatherbitPM10.has(key)) {
            const predictedValue = pWeatherbitPM10.get(key);
            totalMath_pWeatherbitPM10 += Math.abs(predictedValue - actualValue);
            count_pWeatherbitPM10++;
          }

          if (!isNaN(actualValue) && pAirqualityPM10.has(key)) {
            const predictedValue = pAirqualityPM10.get(key);
            totalMath_pAirqualityPM10 += Math.abs(predictedValue - actualValue);
            count_pAirqualityPM10++;
          }
        });

      let mea_OpenwethePM10 =
        count_pOpenwetherPM10 > 0
          ? totalMath_pOpenwetherPM10 / count_pOpenwetherPM10
          : null;
      let mea_WeatherbitPM10 =
        count_pWeatherbitPM10 > 0
          ? totalMath_pWeatherbitPM10 / count_pWeatherbitPM10
          : null;
      let mea_AirqualityPM10 =
        count_pAirqualityPM10 > 0
          ? totalMath_pAirqualityPM10 / count_pAirqualityPM10
          : null;

      let mea25 = [
        {
          name: "Openwether",
          value: mea_OpenwethePM25.toFixed(2),
        },
        {
          name: "Weatherbit",
          value: mea_WeatherbitPM25.toFixed(2),
        },
        {
          name: "OpenMeteo",
          value: mea_AirqualityPM25.toFixed(2),
        },
      ];

      let mea10 = [
        {
          name: "Openwether",
          value: mea_OpenwethePM10.toFixed(2),
        },
        {
          name: "Weatherbit",
          value: mea_WeatherbitPM10.toFixed(2),
        },
        {
          name: "OpenMeteo",
          value: mea_AirqualityPM10.toFixed(2),
        },
      ];

      const bestMea25 = mea25.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      const bestMea10 = mea10.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      return {
        pm25: {
          data: mea25,
          bestdata: bestMea25,
        },
        pm10: {
          data: mea10,
          bestdata: bestMea10,
        },
      };
    }
    let MAE = await CalculateMAE(
      result_air4nkp,
      result_openweather,
      result_weatherbit,
      result_airquality
    );

    // คำนวนค่า MSE
    async function CalculateMSE(
      actualData,
      result_openweather,
      result_weatherbit,
      result_airquality
    ) {
      //  เป็นส่วนของการ กรอง ข้อมูล เฉพาะ เวลา ที่มีเหมือนกันของ 3 api
      const commonInA = result_openweather.filter(
        (itemA) =>
          result_weatherbit.some(
            (itemB) =>
              itemB.date_keep.split(" ")[1] === itemA.date_keep.split(" ")[1]
          ) &&
          result_airquality.some(
            (itemC) =>
              itemC.date_keep.split(" ")[1] === itemA.date_keep.split(" ")[1]
          )
      );
      const commonInB = result_weatherbit.filter(
        (itemB) =>
          result_openweather.some(
            (itemA) =>
              itemA.date_keep.split(" ")[1] === itemB.date_keep.split(" ")[1]
          ) &&
          result_airquality.some(
            (itemC) =>
              itemC.date_keep.split(" ")[1] === itemB.date_keep.split(" ")[1]
          )
      );
      const commonInC = result_airquality.filter(
        (itemC) =>
          result_openweather.some(
            (itemA) =>
              itemA.date_keep.split(" ")[1] === itemC.date_keep.split(" ")[1]
          ) &&
          result_weatherbit.some(
            (itemB) =>
              itemB.date_keep.split(" ")[1] === itemC.date_keep.split(" ")[1]
          )
      );

      // Open wether PM25
      let mseOpenwetherPM25 = 0;
      let nOpenwetherPM25 = 0;
      actualData
        .filter((item) => item.type == "pm25")
        .forEach((actualItem) => {
          const predictedItem = commonInA
            .filter((item) => item.type == "pm25")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseOpenwetherPM25 += Math.pow(
              actualItem.value - predictedItem.value,
              2
            );
            nOpenwetherPM25++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_openwether_pm25 =
        nOpenwetherPM25 > 0 ? mseOpenwetherPM25 / nOpenwetherPM25 : 0;

      // Wether Bit PM25
      let mseWetherBitPM25 = 0;
      let nWetherBitPM25 = 0;
      actualData
        .filter((item) => item.type == "pm25")
        .forEach((actualItem) => {
          const predictedItem = commonInB
            .filter((item) => item.type == "pm25")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseWetherBitPM25 += Math.pow(
              actualItem.value - predictedItem.value,
              2
            );
            nWetherBitPM25++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_wetherbit_pm25 =
        nWetherBitPM25 > 0 ? mseWetherBitPM25 / nWetherBitPM25 : 0;

      // Wether Bit PM25
      let mseMeteoPM25 = 0;
      let nMeteoPM25 = 0;
      actualData
        .filter((item) => item.type == "pm25")
        .forEach((actualItem) => {
          const predictedItem = commonInC
            .filter((item) => item.type == "pm25")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseMeteoPM25 += Math.pow(actualItem.value - predictedItem.value, 2);
            nMeteoPM25++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_meteo_pm25 = nMeteoPM25 > 0 ? mseMeteoPM25 / nMeteoPM25 : 0;
      //------------------------------ END PM25 ------------------------------

      // Open wether PM10
      let mseOpenwetherPM10 = 0;
      let nOpenwetherPM10 = 0;
      actualData
        .filter((item) => item.type == "pm10")
        .forEach((actualItem) => {
          const predictedItem = commonInA
            .filter((item) => item.type == "pm10")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseOpenwetherPM10 += Math.pow(
              actualItem.value - predictedItem.value,
              2
            );
            nOpenwetherPM10++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_openwether_pm10 =
        nOpenwetherPM10 > 0 ? mseOpenwetherPM10 / nOpenwetherPM10 : 0;

      // Wether Bit PM10
      let mseWetherBitPM10 = 0;
      let nWetherBitPM10 = 0;
      actualData
        .filter((item) => item.type == "pm10")
        .forEach((actualItem) => {
          const predictedItem = commonInB
            .filter((item) => item.type == "pm10")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseWetherBitPM10 += Math.pow(
              actualItem.value - predictedItem.value,
              2
            );
            nWetherBitPM10++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_wetherbit_pm10 =
        nWetherBitPM10 > 0 ? mseWetherBitPM10 / nWetherBitPM10 : 0;

      // Wether Bit PM10
      let mseMeteoPM10 = 0;
      let nMeteoPM10 = 0;
      actualData
        .filter((item) => item.type == "pm10")
        .forEach((actualItem) => {
          const predictedItem = commonInC
            .filter((item) => item.type == "pm10")
            .find(
              (pred) =>
                pred.date_keep.split(" ")[1] ===
                actualItem.date_keep.split(" ")[1]
            );
          if (predictedItem) {
            // คำนวณผลต่างระหว่างค่าจริงและค่าพยากรณ์
            mseMeteoPM10 += Math.pow(actualItem.value - predictedItem.value, 2);
            nMeteoPM10++; // นับจำนวนที่จับคู่ได้
          }
        });
      let result_meteo_pm10 = nMeteoPM10 > 0 ? mseMeteoPM10 / nMeteoPM10 : 0;
      //------------------------------ END PM10 ------------------------------

      let mse25 = [
        {
          name: "Openwether",
          value: result_openwether_pm25.toFixed(2),
        },
        {
          name: "Weatherbit",
          value: result_wetherbit_pm25.toFixed(2),
        },
        {
          name: "OpenMeteo",
          value: result_meteo_pm25.toFixed(2),
        },
      ];
      let mse10 = [
        {
          name: "Openwether",
          value: result_openwether_pm10.toFixed(2),
        },
        {
          name: "Weatherbit",
          value: result_wetherbit_pm10.toFixed(2),
        },
        {
          name: "OpenMeteo",
          value: result_meteo_pm10.toFixed(2),
        },
      ];

      // Return Best Calculate
      const bestMse25 = mse25.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      const bestMse10 = mse10.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      return {
        pm25: {
          data: mse25,
          bestdata: bestMse25,
        },
        pm10: {
          data: mse10,
          bestdata: bestMse10,
        },
      };
    }
    let MSE = await CalculateMSE(
      result_air4nkp,
      result_openweather,
      result_weatherbit,
      result_airquality
    );

    // คำนวนค่า RMSE
    async function CalculateRMSE(MSE) {
      let rmse25 = MSE.pm25.data.map((item) => {
        const { value, ...rest } = item;
        return {
          value: Math.sqrt(item.value).toFixed(2),
          ...rest,
        };
      });
      let rmse10 = MSE.pm10.data.map((item) => {
        const { value, ...rest } = item;
        return {
          value: Math.sqrt(item.value).toFixed(2),
          ...rest,
        };
      });

      // Return Best Calculate
      const bestRmse25 = rmse25.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      const bestRmse10 = rmse10.reduce(
        (prev, curr) => {
          const currentValue = parseFloat(curr.value); // แปลง value จาก string เป็นตัวเลข
          return Math.abs(currentValue) < Math.abs(prev.value) ? curr : prev;
        },
        { name: null, value: Infinity }
      );

      return {
        pm25: {
          data: rmse25,
          bestdata: bestRmse25,
        },
        pm10: {
          data: rmse10,
          bestdata: bestRmse10,
        },
      };
    }
    let RMSE = await CalculateRMSE(MSE);
    // ---------------------------- END Process Calculate ----------------------------

    return res.json({
      code: 0,
      res: {
        mae: MAE, // ส่งค่าการคำนวณ Mean Absolute Error (MAE) กลับไปยัง client
        mse: MSE, // ส่งค่าการคำนวณ Mean Squared Error (MSE) กลับไปยัง client
        rmse: RMSE, // ส่งค่าการคำนวณ Root Mean Squared Error (RMSE) กลับไปยัง client
      },
    });
  } catch (error) {
    console.error("Error in calculate:", error);
    next(error);
  }
};
