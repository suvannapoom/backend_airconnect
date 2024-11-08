const axios = require("axios");
const moment = require("moment");
const createError = require("../utils/createError");

exports.getDustList = async (req, res, next) => {
  try {
    const response = await axios.get(
      "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php"
    );

    const dustData = response.data;

    if (!dustData) {
      return next(createError("data not found", 400));
    }

    res.json({ dust: dustData });
  } catch (error) {
    next(error);
  }
};

exports.getDataDust = async (req, res, next) => {
  try {
    const dateData = {
      from: moment().subtract(60, "days").format("L"),
      to: moment().format("L"),
    };

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

    if (!dustData) {
      return next(createError("data not found", 400));
    }

    res.json({ dust: dustData });
  } catch (error) {
    next(error);
  }
};
