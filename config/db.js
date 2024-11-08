// config/db.js
const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root", // เปลี่ยนเป็นชื่อผู้ใช้ของคุณ
  password: "", // เปลี่ยนเป็นรหัสผ่านของคุณ
  database: "airdb", // เปลี่ยนเป็นชื่อฐานข้อมูลของคุณ
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database.");
});

module.exports = connection;
