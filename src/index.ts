import express from "express";
import dotenv from "dotenv";
import path from "path";
import envRoutes from "./routes/envRoutes";

dotenv.config(); // 環境変数の読み込み

const app = express();
const PORT = process.env.PORT || 8000;

// 静的ファイルの提供 (フロントエンド用)
app.use(express.static(path.join(__dirname, "../public")));

// `/env` エンドポイントを設定
app.use(envRoutes);

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
