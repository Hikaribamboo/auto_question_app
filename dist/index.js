"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const question_1 = __importDefault(require("./routes/question"));
const app = (0, express_1.default)();
const port = 3000;
// JSONボディの解析用ミドルウェア
app.use(express_1.default.json());
// ルーティング
app.use('/question', question_1.default);
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
