const express = require("express");
const cors = require("cors");

const authRoute = require("./routes/authRoute");
const dustRoute = require("./routes/dustRoute");

const notFoundMiddleware = require("./middlewares/notFound");
const errorMiddleware = require("./middlewares/error");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/auth", authRoute);
app.use("/dust", dustRoute);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const port = 3333;

app.listen(port, () => console.log(`server is running on port: ${port}`));
