require("dotenv").config(); // โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env

const bcrypt = require("bcrypt"); // ไลบรารีสำหรับการแฮชและตรวจสอบรหัสผ่าน
const jwt = require("jsonwebtoken"); // ไลบรารีสำหรับการสร้างและตรวจสอบ JSON Web Tokens (JWT)
const crypto = require("crypto"); // โมดูลในตัว Node.js สำหรับการสร้างโทเค็นการยืนยันและโทเค็นรีเซ็ตรหัสผ่าน
const nodemailer = require("nodemailer"); // ไลบรารีสำหรับการส่งอีเมล
const db = require("../config/db"); // โมดูลสำหรับการเชื่อมต่อและทำงานกับฐานข้อมูล MySQL
const md5 = require("md5");

// ฟังก์ชันสำหรับการลงทะเบียนผู้ใช้ใหม่ (sign up)
exports.signUp = async (req, res, next) => {
  try {
    const { email, name, password, confirmPassword, userType } = req.body;
    console.log("Received signUp request:", {
      email,
      name,
      password,
      confirmPassword,
      userType,
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
        ) VALUES (?, ?, ?, 'manual', ?, NOW())`;

      db.query(
        insertQuery,
        [name, email, hashedPassword, userType, token_login],
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
              date_expired,
              create_date
            ) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())`;

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
                text: `หากต้องการเสร็จสิ้นการสร้างบัญชี Airconnect ของคุณ โปรดยืนยันที่อยู่อีเมลของคุณโดยคลิกลิงก์นี้: http://localhost:5173/verifysuccess?token=${verificationToken}\n\nรหัสการยืนยันตัวตนจะหมดอายุภายใน 10 นาที\n\nAirconnect\n\nรหัสการยืนยันตัวตนจะหมดอายุภายใน 10 นาที`,
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
// ฟังก์ชันสำหรับการยืนยันอีเมล
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

    // ตรวจสอบโทเค็นการยืนยัน
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("Invalid or expired token:", err);
        return res.json({
          code: 101,
          message: "Invalid or expired token",
        });
      }

      const query =
        "SELECT * FROM tbl_register WHERE is_verified = 0 AND verification_token = ?";
      db.query(query, [token], async (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return next(err);
        }

        if (results.length === 0) {
          console.log("Invalid token");
          return res.json({
            code: 101,
            message: "Invalid token",
          });
        }

        // ตรวจสอบเวลาหมดอายุของ token
        const tokenCreationTime = decoded.iat * 1000; // เวลาที่สร้าง token ในหน่วยมิลลิวินาที
        const currentTime = Date.now(); // เวลาปัจจุบันในหน่วยมิลลิวินาที
        const tokenExpirationTime = tokenCreationTime + 10 * 60 * 1000; // เวลาหมดอายุของ token (10 นาที)

        if (currentTime > tokenExpirationTime) {
          console.log("Token has expired");
          return res.json({
            code: 102,
            message: "ไม่สามารถยืนยันได้ เพราะลิ้งค์หมดอายุ",
          });
        }

        // อัปเดตสถานะการยืนยันอีเมลใน tbl_register
        const updateQuery =
          "UPDATE tbl_register SET is_verified = 1 WHERE verification_token = ?";
        db.query(updateQuery, [token], (err, results) => {
          if (err) {
            console.error("Database update error:", err);
            return next(err);
          }
          console.log("Email verified successfully");

          res.json({
            code: 0,
            message: "Verified successfully",
          });
        });
      });
    });
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    next(error);
  }
};

// ฟังก์ชันสำหรับการส่งอีเมลยืนยันใหม่
exports.resendVerify = async (req, res, next) => {
  const { token } = req.body;
  console.log("Received resendVerify request with token:", token);
  const query = "SELECT * FROM tbl_user WHERE tokenlogin = ?";
  db.query(query, [token], async (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return next(err);
    }
    if (results.length === 0) {
      console.log("Invalid token");
      return res.status(400).json({ message: "Invalid token" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    console.log("Email transporter set up successfully");
    const verificationToken = jwt.sign(
      { email: results[0].MemEmail },
      process.env.JWT_SECRET,
      { expiresIn: "1m" } // Token มีอายุการใช้งาน 1 นาที
    );
    console.log("Generated verification token:", verificationToken);

    let query =
      "UPDATE tbl_user SET verificationToken = ?, date_tokenverify = NOW() WHERE tokenlogin = ?";
    db.query(query, [verificationToken, token], (err, results) => {
      if (err) {
        console.error("Database update error:", err);
        return next(err);
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: results[0].MemEmail,
      subject: "ยืนยันบัญชี Airconnect ของคุณ",
      text: `หากต้องการเสร็จสิ้นการสร้างบัญชี Airconnect ของคุณ โปรดยืนยันที่อยู่อีเมลของคุณอีกครั้งโดยคลิกลิงก์นี้: http://localhost:5173/verifysuccess?token=${verificationToken}\n\nรหัสการยืนยันตัวตนจะหมดอายุภายใน 1 นาที\n\nAirconnect`,
    };

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
  });
};

// ฟังก์ชันสำหรับการเข้าสู่ระบบ
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log("Received login request:", { username, password });

    // ตรวจสอบว่ามีผู้ใช้ในฐานข้อมูลหรือไม่
    const query = "SELECT * FROM tbl_user WHERE usr_emaul = ?";
    db.query(query, [username], async (err, result_user) => {
      if (err) {
        console.error("Database query error:", err);
        return next(err);
      }

      if (result_user.length === 0) {
        return res.json({
          code: 201,
          message: "อีเมลหรือรหัสไม่ถูกต้อง",
        });
      }

      const hashedPassword = await md5(password);

      if (
        result_user[0].usr_password != hashedPassword &&
        result_user.length > 0
      ) {
        return res.json({
          code: 201,
          message: "อีเมลหรือรหัสไม่ถูกต้อง",
        });
      } else if (result_user.length > 0) {
        // Update Tokenlogin
        var token_login = crypto.randomBytes(64).toString("hex");
        let query =
          "UPDATE tbl_user SET usr_tokenlogin = ? WHERE usr_email = ?";
        db.query(query, [token_login, result_user[0].usr_email]);

        // Find is Verify
      }
    });
  } catch (error) {
    console.error("Error in login:", error);
    next(error);
  }
};

exports.authen = (req, res, next) => {
  const token = req.header("Authorization").replace("Bearer ", "");
  console.log("Received authen request with token:", token);

  if (!token) {
    console.log("No token provided");
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log("Token verified, user:", decoded);
    next();
  } catch (error) {
    console.error("Invalid token:", error);
    res.status(400).json({ message: "Invalid token." });
  }
};
