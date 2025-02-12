require("dotenv").config(); // โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env

const bcrypt = require("bcrypt"); // ไลบรารีสำหรับการแฮชและตรวจสอบรหัสผ่าน
const jwt = require("jsonwebtoken"); // ไลบรารีสำหรับการสร้างและตรวจสอบ JSON Web Tokens (JWT)
const crypto = require("crypto"); // โมดูลในตัว Node.js สำหรับการสร้างโทเค็นการยืนยันและโทเค็นรีเซ็ตรหัสผ่าน
const nodemailer = require("nodemailer"); // ไลบรารีสำหรับการส่งอีเมล
const db = require("../config/db"); // โมดูลสำหรับการเชื่อมต่อและทำงานกับฐานข้อมูล MySQL
const md5 = require("md5");
const moment = require("moment-timezone");

// ฟังก์ชันสำหรับการลงทะเบียนผู้ใช้ใหม่ (sign up)
exports.signUp = async (req, res, next) => {
  try {
    const { email, name, password, confirmPassword } = req.body;
    console.log("Received signUp request:", {
      email,
      name,
      password,
      confirmPassword,
    });

    // ตรวจสอบความถูกต้องของอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format");
      return res.status(400).json({ message: "Invalid email format" });
    }

    // ตรวจสอบความถูกต้องของรหัสผ่าน
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      console.log("Invalid password format");
      return res.status(400).json({
        message: "คุณกรอกรูปแบบรหัสผ่านไม่ถูกต้อง",
      });
    }

    // ตรวจสอบว่ารหัสผ่านและการยืนยันรหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
      console.log("Passwords do not match");
      return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
    }

    // แฮชรหัสผ่าน
    const hashedPassword = await md5(password);
    console.log("Hashed password:", hashedPassword);

    // สร้างโทเค็นแบบสุ่มที่มีความยาว 64 ไบต์และแปลงเป็นสตริงในรูปแบบฐานสิบหก
    const token_login = crypto.randomBytes(64).toString("hex");
    console.log("Generated token:", token_login);

    // สร้างโทเค็นการยืนยัน
    const verificationToken = jwt.sign(
      { email },
      process.env.JWT_SECRET,
      { expiresIn: "10m" } // Token มีอายุการใช้งาน 10 นาที
    );
    console.log("Generated verification token:", verificationToken);

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_users WHERE usr_email = ?";
    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      if (results.length > 0) {
        return res.json({
          code: 101,
          message: "อีเมลนี้มีผู้ใช้นี้อยู่ในระบบแล้ว",
        });
      }

      // เพิ่มผู้ใช้ใหม่ในฐานข้อมูล
      const insertQuery = `
        INSERT INTO tbl_users (
          usr_displayname,
          usr_email,
          usr_password,
          usr_type,
          token_login,
          date_register
        ) VALUES (?, ?, ?, ?, ?, NOW())`;

      db.query(
        insertQuery,
        [name, email, hashedPassword, "manual", token_login],
        (err, results) => {
          if (err) {
            console.error("Database insert error:", err);
            return next(err);
          }

          // ดึง usr_id ของผู้ใช้ที่เพิ่มใหม่
          const usr_id = results.insertId;

          // เพิ่มข้อมูลลงในตาราง tbl_register
          const insertRegisterQuery = `
            INSERT INTO tbl_register (
              usr_id,
              is_verified,
              verification_token,
              date_expired
            ) VALUES (?, ?, ?,NOW())`;

          db.query(
            insertRegisterQuery,
            [usr_id, 0, verificationToken],
            (err, results) => {
              if (err) {
                console.error("Database insert error:", err);
                return next(err);
              }

              // ส่งอีเมลยืนยัน
              const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  user: process.env.GMAIL_USER,
                  pass: process.env.GMAIL_PASS,
                },
              });

              const mailOptions = {
                from: process.env.GMAIL_USER,
                to: email,
                subject: "ยืนยันบัญชี Airconnect ของคุณ",
                text: `หากต้องการเสร็จสิ้นการสร้างบัญชี Airconnect ของคุณ โปรดยืนยันที่อยู่อีเมลของคุณโดยคลิกลิงก์นี้: http://localhost:5173/verifysuccess?token=${verificationToken}\n\nAirconnect\n`,
              };

              transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.error("Error sending email:", error);
                  return next(error);
                }
                console.log("Email sent:", info.response);
                res.json({
                  code: 0,
                  message:
                    "User signed up successfully. Please check your email to verify your account.",
                  token: token_login,
                });
              });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Error in signUp:", error);
    next(error);
  }
};
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    console.log("Received verifyEmail request with token:", token);

    // ตรวจสอบว่า token ถูกส่งมาในรูปแบบที่ถูกต้องหรือไม่
    if (!token || typeof token !== "string") {
      console.error("Invalid token format");
      return res.json({
        code: 101,
        message: "Invalid token format",
      });
    }

    // ตรวจสอบว่า token มีอยู่ในฐานข้อมูลและยังไม่หมดอายุ
    const query =
      "SELECT * FROM tbl_register WHERE is_verified = 0 AND verification_token = ? AND date_expired > NOW() - INTERVAL 1 MINUTE";
    db.query(query, [token], async (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        console.log("Token has expired");
        return res.json({
          code: 102,
          message: "ไม่สามารถยืนยันได้ เพราะลิ้งค์หมดอายุ", // ส่ง response กลับไปยัง client ว่า token หมดอายุแล้ว
        });
      } else {
        // อัปเดตสถานะการยืนยันอีเมลใน tbl_register
        const updateQuery =
          "UPDATE tbl_register SET is_verified = 1 WHERE verification_token = ?";
        db.query(updateQuery, [token], (err, results) => {
          if (err) {
            console.error("Database update error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ update ฐานข้อมูล
            return next(err);
          }
          console.log("Email verified successfully");

          res.json({
            code: 0,
            message: "Verified successfully", // ส่ง response กลับไปยัง client ว่ายืนยันอีเมลสำเร็จ
          });
        });
      }
    });
  } catch (error) {
    console.error("Error in verifyEmail:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};

exports.resendVerify = async (req, res, next) => {
  const { token } = req.body;
  console.log("Received resendVerify request with token:", token);
  const query = "SELECT * FROM tbl_users WHERE token_login = ?";

  db.query(query, [token], async (err, results_usr) => {
    console.log(results_usr);
    const query_checklink =
      "SELECT date_expired FROM tbl_register WHERE usr_id = ?";

    db.query(query_checklink, [results_usr[0].usr_id], async (err, results) => {
      let createdAt = moment(results[0].date_expired, "YYYY-MM-DD HH:mm:ss"); // ตัวอย่างเวลาเก่า
      // รับเวลาปัจจุบัน
      let now = moment().tz("Asia/Bangkok");
      // คำนวณความแตกต่างระหว่างเวลาปัจจุบันกับเวลาที่เก็บใน createdAt (ในหน่วยนาที)
      let diffInMinutes = now.diff(createdAt, "minutes"); // ความแตกต่างในหน่วยนาที
      console.log("diffInMinutes", diffInMinutes);
      // เช็คว่าเวลานั้นเกิน 10 นาทีหรือยัง
      if (diffInMinutes < 10) {
        return res.json({
          code: 202,
          message:
            "ไม่สามารถทำรายการ ลิ้งค์คุณยังไม่หมดอายุ กรุณากลับไปยืนยันอีเมล",
        });
      } else {
        console.log("Pass");
        if (results_usr.length === 0) {
          console.log("Invalid token");
          return res.status(400).json({ message: "Invalid token" });
        } else {
          // ตั้งค่า nodemailer สำหรับส่งอีเมล
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS,
            },
          });
          console.log("Email transporter set up successfully");

          // สร้าง verification token ใหม่
          const verificationToken = jwt.sign(
            { email: results_usr[0].usr_email },
            process.env.JWT_SECRET,
            { expiresIn: "10m" } // Token มีอายุการใช้งาน 10 นาที
          );
          console.log("Generated verification token:", verificationToken);

          // อัปเดต verification token และวันที่หมดอายุในฐานข้อมูล
          const timeInUTC = moment
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
          let query =
            "UPDATE tbl_register SET verification_token = ?, date_expired = ? WHERE usr_id = ?";
          db.query(
            query,
            [verificationToken, timeInUTC, results_usr[0].usr_id],
            (err, results) => {
              if (err) {
                console.error("Database update error:", err);
                return next(err);
              }
            }
          );

          // ตั้งค่าอีเมลที่จะส่ง
          const mailOptions = {
            from: process.env.GMAIL_USER,
            to: results_usr[0].usr_email,
            subject: "ยืนยันบัญชี Airconnect ของคุณ",
            text: `หากต้องการเสร็จสิ้นการสร้างบัญชี Airconnect ของคุณ โปรดยืนยันที่อยู่อีเมลของคุณอีกครั้งโดยคลิกลิงก์นี้: http://localhost:5173/verifysuccess?token=${verificationToken}\n\nAirconnect`,
          };

          // ส่งอีเมล
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending email:", error);
              return next(error);
            }
            console.log("Email sent:", info.response);
            res.json({
              code: 0,
              message: "ส่งอีเมลยืนยันใหม่สำเร็จ",
            });
          });
        }
      }
    });
  }); // Query
};
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log("Received login request:", { username, password });

    // แปลงรหัสผ่านเป็น hash ด้วย md5
    const hashedPassword = await md5(password);

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_users WHERE usr_email = ? AND usr_password = ?";
    db.query(query, [username, hashedPassword], async (err, result_user) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      // ถ้าพบผู้ใช้ในฐานข้อมูล
      if (result_user.length > 0) {
        // สร้าง token สำหรับการเข้าสู่ระบบ
        var token_login = crypto.randomBytes(64).toString("hex");

        // อัปเดต token_login ในฐานข้อมูล
        let query = "UPDATE tbl_users SET token_login = ? WHERE usr_email = ?";
        db.query(query, [token_login, result_user[0].usr_email], (err) => {
          if (err) {
            console.error("Database update error:", err);
            return next(err);
          }

          // ตรวจสอบว่าผู้ใช้ได้ยืนยันอีเมลแล้วหรือไม่
          const queryregister =
            "SELECT is_verified FROM tbl_register WHERE usr_id = ?";
          db.query(
            queryregister,
            [result_user[0].usr_id],
            (err, results_verify) => {
              if (err) {
                console.error("Database query error:", err);
                return next(err);
              }

              // ถ้าผู้ใช้ยังไม่ได้ยืนยันอีเมล
              if (
                results_verify.length > 0 &&
                results_verify[0].is_verified == 0
              ) {
                // สร้าง verification token
                const verificationToken = crypto
                  .randomBytes(32)
                  .toString("hex");
                const timeInUTC = moment
                  .tz("Asia/Bangkok")
                  .format("YYYY-MM-DD HH:mm:ss");

                // อัปเดต verification token และวันที่หมดอายุในฐานข้อมูล
                let query_tokenverify =
                  "UPDATE tbl_register SET verification_token = ?, date_expired = ? WHERE usr_id = ?";
                db.query(
                  query_tokenverify,
                  [verificationToken, timeInUTC, result_user[0].usr_id],
                  (err) => {
                    if (err) {
                      console.error("Database update error:", err);
                      return next(err);
                    }

                    // ตั้งค่า nodemailer สำหรับส่งอีเมล
                    const transporter = nodemailer.createTransport({
                      service: "gmail",
                      auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_PASS,
                      },
                    });

                    // ตั้งค่าอีเมลที่จะส่ง
                    const mailOptions = {
                      from: process.env.GMAIL_USER,
                      to: result_user[0].usr_email,
                      subject: "ยืนยันบัญชี Airconnect ของคุณ",
                      text: `หากต้องการเสร็จสิ้นการสร้างบัญชี Airconnect ของคุณ โปรดยืนยันที่อยู่อีเมลของคุณโดยคลิกลิงก์: http://localhost:5173/verifysuccess?token=${verificationToken}`,
                    };

                    // ส่งอีเมล
                    transporter.sendMail(mailOptions, (error) => {
                      if (error) {
                        console.error("Error sending email:", error);
                        return next(error);
                      }

                      // ส่ง response กลับไปยัง client
                      res.json({
                        code: 101,
                        message: "คุณยังไม่ได้ยืนยันอีเมล",
                        token: token_login,
                        link: "/verify",
                      });
                    });
                  }
                );
              } else {
                // ถ้าผู้ใช้ยืนยันอีเมลแล้ว
                res.json({
                  code: 0,
                  message: "Login successful",
                  token: token_login,
                });
              }
            }
          );
        });
      } else {
        // ถ้าไม่พบผู้ใช้ในฐานข้อมูล
        res.json({
          code: 201,
          message: "อีเมลหรือรหัสไม่ถูกต้อง",
        });
      }
    });
  } catch (error) {
    console.error("Error in login:", error);
    next(error);
  }
};
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_users WHERE usr_email = ?";
    db.query(query, [email], async (err, results_usr) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results_usr.length === 0) {
        return res.json({
          code: 103,
          message: "ไม่พบอีเมล์นี้ในระบบ", // ส่ง response กลับไปยัง client ว่าไม่พบอีเมลนี้ในระบบ
        });
      }

      // สร้างโทเค็นรีเซ็ตรหัสผ่าน
      const resetToken = jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" } // Token มีอายุการใช้งาน 15 นาที
      );
      console.log("Generated reset token:", resetToken);
      const timeInUTC = moment.tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss");

      // ตรวจสอบว่ามีข้อมูลการรีเซ็ตรหัสผ่านในฐานข้อมูลหรือไม่
      const queryInsertforgot =
        "SELECT usr_id FROM tbl_forgotpassword WHERE usr_id = ?";
      db.query(
        queryInsertforgot,
        [results_usr[0].usr_id],
        async (err, results_forgot) => {
          if (results_forgot.length > 0) {
            // อัปเดตโทเค็นรีเซ็ตรหัสผ่านและวันที่หมดอายุในฐานข้อมูล
            const updateQuery =
              "UPDATE tbl_forgotpassword SET verification_token = ?, date_expired = ? WHERE usr_id = ?";
            db.query(updateQuery, [
              resetToken,
              timeInUTC,
              results_forgot[0].usr_id,
            ]);
          } else {
            // เพิ่มข้อมูลการรีเซ็ตรหัสผ่านใหม่ในฐานข้อมูล
            const insertfogot =
              "INSERT INTO tbl_forgotpassword (usr_id, verification_token, date_expired) VALUES (?, ?, ?)";
            db.query(insertfogot, [
              results_usr[0].usr_id,
              resetToken,
              timeInUTC,
            ]);
          }
        }
      );

      // ส่งอีเมลรีเซ็ตรหัสผ่าน
      console.log("Setting up email transporter");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      console.log("Email transporter set up successfully");

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: "รีเซ็ตรหัสผ่าน Airconnect ของคุณ",
        text: `หากต้องการรีเซ็ตรหัสผ่านของคุณ โปรดคลิกลิงก์นี้: http://localhost:5173/resetpass?token=${resetToken}\n\nAirconnect`,
      };

      console.log("Sending reset password email to:", email);
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในการส่งอีเมล
          return next(error);
        }
        console.log("Email sent:", info.response);
        res.json({
          code: 0,
          message: "ส่งอีเมลรีเซ็ตรหัสผ่านสำเร็จ", // ส่ง response กลับไปยัง client ว่าส่งอีเมลรีเซ็ตรหัสผ่านสำเร็จ
        });
      });
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    console.log(token, password);

    // ตรวจสอบว่า token มีอยู่ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_forgotpassword WHERE verification_token = ?";
    db.query(query, [token], async (err, results_usr) => {
      if (results_usr.length > 0) {
        // ตรวจสอบว่า token หมดอายุหรือยัง
        let createdAt = moment(
          results_usr[0].date_expired,
          "YYYY-MM-DD HH:mm:ss"
        ); // เวลาที่ token ถูกสร้าง
        let now = moment().tz("Asia/Bangkok");
        let diffInMinutes = now.diff(createdAt, "minutes"); // ความแตกต่างในหน่วยนาที
        console.log(diffInMinutes);

        // ถ้า token ยังไม่หมดอายุ (ภายใน 10 นาที)
        if (diffInMinutes < 10) {
          // แปลงรหัสผ่านใหม่เป็น hash ด้วย md5
          let hashedPassword = md5(password);
          console.log(hashedPassword);

          // สร้าง token สำหรับการเข้าสู่ระบบใหม่
          var token_login = crypto.randomBytes(64).toString("hex");

          // อัปเดตรหัสผ่านและ token_login ในฐานข้อมูล
          const queryUpdatepass =
            "UPDATE tbl_users SET usr_password = ?, token_login = ? WHERE usr_id = ?";
          db.query(
            queryUpdatepass,
            [hashedPassword, token_login, results_usr[0].usr_id],
            (err, result_update) => {
              console.log(err, result_update);
            }
          );

          // อัปเดตวันที่หมดอายุของ token เป็นวันที่เก่า
          const queryUpdateExpireddate =
            "UPDATE tbl_forgotpassword SET date_expired = ? WHERE usr_id = ?";
          db.query(
            queryUpdateExpireddate,
            ["0000-00-00 00:00:00", results_usr[0].usr_id],
            (err, result_expire) => {
              console.log(err, result_expire);
            }
          );

          // ส่ง response กลับไปยัง client ว่าการเปลี่ยนรหัสผ่านสำเร็จ
          return res.json({
            code: 0,
            message: "Change password Susccess",
            token: token_login,
          });
        } else {
          // ถ้า token หมดอายุ
          return res.json({
            code: 103,
            message:
              "คุณไม่ได้ทำรายการ ในเวลาที่กำหนด กรุณาทำรายการใหม่อีกครั้ง.",
          });
        }
      } else {
        // ถ้าไม่พบ token ในฐานข้อมูล
        return res.json({
          code: 201,
          message: "เกิดผิดพลาดไม่สามารถทำรายการได้",
        });
      }
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
exports.checkexpiriedpassword = async (req, res, next) => {
  const { token } = req.body;
  console.log("Received resendVerify request with token:", token);
  const query = "SELECT * FROM tbl_forgotpassword WHERE verification_token = ?";

  db.query(query, [token], async (err, results_usr) => {
    const query_checklink = "SELECT * FROM tbl_forgotpassword WHERE usr_id = ?";
    db.query(query_checklink, [results_usr[0].usr_id], async (err, results) => {
      if (results.length > 0) {
        // รับเวลาปัจจุบัน
        let now = moment().tz("Asia/Bangkok");
        let createdAt = moment(results[0].date_expired, "YYYY-MM-DD HH:mm:ss"); // ตัวอย่างเวลาเก่า
        // คำนวณความแตกต่างระหว่างเวลาปัจจุบันกับเวลาที่เก็บใน createdAt (ในหน่วยนาที)
        let diffInMinutes = now.diff(createdAt, "minutes"); // ความแตกต่างในหน่วยนาที
        console.log("diffInMinutes", diffInMinutes);
        // เช็คว่าเวลานั้นเกิน 10 นาทีหรือยัง
        var token_login = crypto.randomBytes(64).toString("hex");
        let query = "UPDATE tbl_users SET token_login = ? WHERE usr_id = ?";
        db.query(query, [token_login, results[0].usr_id]);
        if (diffInMinutes < 1) {
          return res.json({
            code: 0,
            message: "สามารถใช้งานได้", // ส่ง response กลับไปยัง client ว่า token ยังสามารถใช้งานได้
          });
        } else {
          return res.json({
            code: 105,
            message: "ไม่สามารถใช้งานได้ ลิ้งหมดอายุ", // ส่ง response กลับไปยัง client ว่า token หมดอายุแล้ว
          });
        }
      } else {
        return res.json({
          code: 104,
          message: "เกิดข้อผิดพลาดไม่พบข้อมูล", // ส่ง response กลับไปยัง client ว่าไม่พบข้อมูล
        });
      }
    });
  }); // Query
};
exports.getProfile = async (req, res, next) => {
  try {
    const { token_login } = req.body; // รับค่า token_login จาก body ของคำขอ
    if (!token_login) {
      return res.status(400).json({ message: "token_login is required" }); // ตรวจสอบว่ามี token_login หรือไม่
    }

    // คำสั่ง SQL เพื่อดึงข้อมูลโปรไฟล์ผู้ใช้จากฐานข้อมูล
    const query =
      "SELECT usr_displayname, usr_email FROM tbl_users WHERE token_login = ?";
    db.query(query, [token_login], (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.json({
          code: 101,
          message: "ไม่พบข้อมูล", // ส่ง response กลับไปยัง client ว่าไม่พบข้อมูล
        });
      }

      // ดึงข้อมูลโปรไฟล์ผู้ใช้จากผลลัพธ์ของการ query
      const { usr_displayname, usr_email } = results[0];
      res.json({
        code: 0,
        message: "Profile retrieved successfully", // ส่ง response กลับไปยัง client ว่าดึงข้อมูลโปรไฟล์สำเร็จ
        displayName: usr_displayname,
        email: usr_email,
      });
    });
  } catch (error) {
    console.error("Error in getProfile:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.logout = async (req, res, next) => {
  try {
    const { token_login } = req.body; // รับค่า token_login จาก body ของคำขอ
    if (!token_login) {
      return res.status(400).json({ message: "token_login is required" }); // ตรวจสอบว่ามี token_login หรือไม่
    }

    console.log("Received logout request with token_login:", token_login);

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_users WHERE token_login = ?";
    db.query(query, [token_login], (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.status(400).json({ message: "Invalid token_login" }); // ส่ง response กลับไปยัง client ว่า token_login ไม่ถูกต้อง
      }

      console.log("User logged out successfully");

      res.json({
        code: 0,
        message: "Logout successful", // ส่ง response กลับไปยัง client ว่าออกจากระบบสำเร็จ
      });
    });
  } catch (error) {
    console.error("Error in logout:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.saveGoogleUser = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    console.log(
      "Received saveGoogleUser request with email and name:",
      email,
      name
    );

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_users WHERE usr_email = ? AND usr_type =  ? ";
    db.query(query, [email, "manual"], async (err, results) => {
      console.log(email);
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      if (results.length > 0) {
        console.log(results.length);
        // ถ้าผู้ใช้มีอยู่แล้วและสมัครโดย manual ให้แสดงข้อความว่าอีเมลนี้มีการสมัครแล้ว
        return res.json({
          code: 101,
          message: "อีเมลนี้มีการสมัครแล้ว",
        });
      }

      // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลที่สมัครโดย google หรือไม่
      const queryGoogle =
        "SELECT * FROM tbl_users WHERE usr_email = ? AND usr_type = 'google'";
      db.query(queryGoogle, [email], async (err, resultsGoogle) => {
        if (err) {
          console.error("Database query error:", err);
          return next(err);
        }

        if (resultsGoogle.length > 0) {
          // ถ้าผู้ใช้มีอยู่แล้วและสมัครโดย google ให้ส่ง token_login กลับไป
          const token_login = resultsGoogle[0].token_login;
          return res.json({
            code: 0,
            message: "User already exists",
            token: token_login,
          });
        }

        // ถ้าผู้ใช้ไม่มีอยู่ ให้เพิ่มผู้ใช้ใหม่ในฐานข้อมูล
        const token_login = md5(crypto.randomBytes(64).toString("hex"));
        const insertQuery = `
          INSERT INTO tbl_users (
            usr_displayname,
            usr_email,
            usr_type,
            token_login,
            date_register
          ) VALUES (?, ?, ?, ?, NOW())`;

        db.query(
          insertQuery,
          [name, email, "google", token_login],
          (err, results) => {
            if (err) {
              console.error("Database insert error:", err);
              return next(err);
            }

            console.log("User saved successfully");
            res.json({
              code: 0,
              message: "User saved successfully",
              token: token_login,
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("Error in saveGoogleUser:", error);
    next(error);
  }
};
exports.saveFacebookUser = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    console.log(
      "Received saveFacebookUser request with email and name:",
      email,
      name
    );

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query =
      "SELECT * FROM tbl_users WHERE usr_email = ? AND usr_type = ?";
    db.query(query, [email, "manual"], async (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      if (results.length > 0) {
        // ถ้าผู้ใช้มีอยู่แล้วและสมัครโดย manual ให้แสดงข้อความว่าอีเมลนี้มีการสมัครแล้ว
        return res.json({
          code: 101,
          message: "อีเมลนี้มีการสมัครแล้ว",
        });
      }

      // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลที่สมัครโดย facebook หรือไม่
      const queryFacebook =
        "SELECT * FROM tbl_users WHERE usr_email = ? AND usr_type = 'facebook'";
      db.query(queryFacebook, [email], async (err, resultsFacebook) => {
        if (err) {
          console.error("Database query error:", err);
          return next(err);
        }

        if (resultsFacebook.length > 0) {
          // ถ้าผู้ใช้มีอยู่แล้วและสมัครโดย facebook ให้ส่ง token_login กลับไป
          const token_login = resultsFacebook[0].token_login;
          return res.json({
            code: 0,
            message: "User already exists",
            token: token_login,
          });
        }

        // ถ้าผู้ใช้ไม่มีอยู่ ให้เพิ่มผู้ใช้ใหม่ในฐานข้อมูล
        const token_login = md5(crypto.randomBytes(64).toString("hex"));
        const insertQuery = `
          INSERT INTO tbl_users (
            usr_displayname,
            usr_email,
            usr_type,
            token_login,
            date_register
          ) VALUES (?, ?, ?, ?, NOW())`;

        db.query(
          insertQuery,
          [name, email, "facebook", token_login],
          (err, results) => {
            if (err) {
              console.error("Database insert error:", err);
              return next(err);
            }

            console.log("User saved successfully");
            res.json({
              code: 0,
              message: "User saved successfully",
              token: token_login,
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("Error in saveFacebookUser:", error);
    next(error);
  }
};
exports.updateName = async (req, res, next) => {
  try {
    const { token_login, displayName } = req.body; // ใช้ displayName แทน new_name
    if (!token_login || !displayName) {
      return res
        .status(400)
        .json({ message: "token_login and displayName are required" }); // ตรวจสอบว่ามี token_login และ displayName หรือไม่
    }

    console.log(
      "Received updateName request with token_login:",
      token_login,
      "and displayName:",
      displayName
    );

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_users WHERE token_login = ?";
    db.query(query, [token_login], (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.status(400).json({ message: "Invalid token_login" }); // ส่ง response กลับไปยัง client ว่า token_login ไม่ถูกต้อง
      }

      // อัปเดต name ของผู้ใช้
      const updateQuery =
        "UPDATE tbl_users SET usr_displayname = ? WHERE token_login = ?";
      db.query(updateQuery, [displayName, token_login], (err) => {
        if (err) {
          console.error("Database update error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ update ฐานข้อมูล
          return next(err);
        }

        console.log("Name updated successfully");

        res.json({
          code: 0,
          message: "Name updated successfully", // ส่ง response กลับไปยัง client ว่าอัปเดตชื่อสำเร็จ
        });
      });
    });
  } catch (error) {
    console.error("Error in updateName:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
exports.updatePassword = async (req, res, next) => {
  try {
    const { token_login, currentPassword, newPassword } = req.body; // เปลี่ยนชื่อให้ตรงกับ Frontend
    if (!token_login || !currentPassword || !newPassword) {
      return res.status(400).json({
        message: "token_login, currentPassword, and newPassword are required",
      }); // ตรวจสอบว่ามี token_login, currentPassword และ newPassword หรือไม่
    }

    console.log(
      "Received updatePassword request with token_login:",
      token_login
    );

    // ตรวจสอบรูปแบบรหัสผ่านใหม่
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: "คุณกรอกรูปแบบรหัสผ่านไม่ถูกต้อง",
      }); // ส่ง response กลับไปยัง client ว่ารูปแบบรหัสผ่านไม่ถูกต้อง
    }

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_users WHERE token_login = ?";
    db.query(query, [token_login], async (err, results) => {
      if (err) {
        console.error("Database query error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ query ฐานข้อมูล
        return next(err);
      }

      if (results.length === 0) {
        return res.status(400).json({ message: "Invalid token_login" }); // ส่ง response กลับไปยัง client ว่า token_login ไม่ถูกต้อง
      }

      const user = results[0];
      const hashedCurrentPassword = md5(currentPassword);

      // ตรวจสอบว่ารหัสผ่านปัจจุบันถูกต้องหรือไม่
      if (user.usr_password !== hashedCurrentPassword) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" }); // ส่ง response กลับไปยัง client ว่ารหัสผ่านปัจจุบันไม่ถูกต้อง
      }

      // แฮชรหัสผ่านใหม่
      const hashedNewPassword = md5(newPassword);

      // อัปเดตรหัสผ่านของผู้ใช้
      const updateQuery =
        "UPDATE tbl_users SET usr_password = ? WHERE token_login = ?";
      db.query(updateQuery, [hashedNewPassword, token_login], (err) => {
        if (err) {
          console.error("Database update error:", err); // แสดงข้อผิดพลาดถ้ามีปัญหาในการ update ฐานข้อมูล
          return next(err);
        }

        console.log("Password updated successfully");

        res.json({
          code: 0,
          message: "Password updated successfully", // ส่ง response กลับไปยัง client ว่าอัปเดตรหัสผ่านสำเร็จ
        });
      });
    });
  } catch (error) {
    console.error("Error in updatePassword:", error); // แสดงข้อผิดพลาดถ้ามีปัญหาในกระบวนการใดๆ
    next(error);
  }
};
