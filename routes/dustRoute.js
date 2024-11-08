const router = require("express").Router();

const dustController = require("../controllers/dustController");

router.get("/get-dust-list", dustController.getDustList);
router.get("/get-data-dust", dustController.getDataDust);

module.exports = router;
