"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const chatWithFile_1 = __importDefault(require("./routes/chatWithFile"));
dotenv_1.default.config(); // .envファイルを読み込み
const app = (0, express_1.default)();
// JSONリクエストのパース
app.use(express_1.default.json());
// ルート設定
app.use('/', chatWithFile_1.default);
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
