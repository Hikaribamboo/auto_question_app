import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import { google } from 'googleapis';
import envRoutes from './routes/envRoutes';

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティ強化のために helmet を使用
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com", "'nonce-<nonce-value>'"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        frameSrc: ["https://accounts.google.com"],
      },
    },
  })
);



// 静的ファイルの提供 (フロントエンド用)
app.use(express.static(path.join(__dirname, '../public')));

// `/env` エンドポイントを設定
app.use(envRoutes);

// OAuth2 クライアント設定
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'http://localhost:3000/oauth2callback' // リダイレクトURI
);

// OAuth 認証エンドポイント
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  res.redirect(authUrl);
});

// OAuth2 コールバックエンドポイント
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code as string;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    res.send('認証成功！このウィンドウを閉じてください。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    res.status(500).send(
      '認証に失敗しました。問題が解決しない場合は再試行してください。'
    );
  }
});


// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
