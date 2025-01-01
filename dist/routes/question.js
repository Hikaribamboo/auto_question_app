"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const questionController_1 = require("../controllers/questionController");
const router = (0, express_1.Router)();
// GET /question
router.get('/', (req, res) => {
    res.send('This is the Question Route!');
});
// POST /question
router.post('/', questionController_1.generateQuestion);
exports.default = router;
