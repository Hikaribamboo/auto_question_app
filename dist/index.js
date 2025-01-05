"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const envRoutes_1 = __importDefault(require("./routes/envRoutes"));
const chatWithFile_1 = __importDefault(require("./routes/chatWithFile")); // ChatGPT関連の処理を別ファイルで管理
// 環境変数の読み込み
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 静的ファイルの提供 (フロントエンド用)
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// `/env` エンドポイントを設定
app.use(envRoutes_1.default); // envRoutes を利用
// OAuth2 クライアント設定
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 'http://localhost:3000/oauth2callback' // リダイレクトURI
);
// OAuth 認証エンドポイント
app.get('/auth', (req, res) => {
    try {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive'],
        });
        res.redirect(authUrl);
    }
    catch (error) {
        console.error('認証エンドポイントでエラーが発生しました:', error);
        res.status(500).send('認証プロセスの開始に失敗しました。後ほど再試行してください。');
    }
});
// OAuth2 コールバックエンドポイント
// OAuth2 コールバックエンドポイント
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code; // 認証コードを取得
    try {
        const { tokens } = await oauth2Client.getToken(code); // 認証コードを使ってアクセストークンを取得
        oauth2Client.setCredentials(tokens); // トークンをOAuth2クライアントに設定
        res.send(`
      <html>
        <body>
          <h1>認証成功！</h1>
          <p>このウィンドウを閉じて操作を続けてください。</p>
        </body>
      </html>
    `);
    }
    catch (error) {
        console.error('トークンの取得中にエラーが発生しました:', error);
        res.status(500).send('認証に失敗しました。もう一度お試しください。');
    }
});
// ChatGPT と連携するエンドポイント
app.use(chatWithFile_1.default); // ChatGPTとファイル連携用のエンドポイント
// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
