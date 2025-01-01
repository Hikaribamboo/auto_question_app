import express from 'express';
import dotenv from 'dotenv';
import chatWithFileRouter from './routes/chatWithFile';

dotenv.config(); // .envファイルを読み込み

const app = express();

// JSONリクエストのパース
app.use(express.json());

// ルート設定
app.use('/', chatWithFileRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
