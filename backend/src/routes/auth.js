const express = require("express");

const AuthController = require("../controllers/auth");
const { authMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/me", authMiddleware, AuthController.me);

module.exports = router;