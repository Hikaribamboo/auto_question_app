"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envRoutes_1 = __importDefault(require("./routes/envRoutes"));
dotenv_1.default.config(); // 環境変数の読み込み
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
// 静的ファイルの提供 (フロントエンド用)
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// `/env` エンドポイントを設定
app.use(envRoutes_1.default);
// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
