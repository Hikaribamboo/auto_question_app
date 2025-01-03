"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const googleapis_1 = require("googleapis");
const envRoutes_1 = __importDefault(require("./routes/envRoutes"));
// 環境変数の読み込み
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// セキュリティ強化のために helmet を使用
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://apis.google.com"],
            connectSrc: ["'self'", "https://accounts.google.com"],
        },
    },
}));
// 静的ファイルの提供 (フロントエンド用)
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// `/env` エンドポイントを設定
app.use(envRoutes_1.default);
// OAuth2 クライアント設定
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 'http://localhost:3000/oauth2callback' // リダイレクトURI
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
    const code = req.query.code;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        res.send('認証成功！このウィンドウを閉じてください。');
    }
    catch (error) {
        console.error('エラーが発生しました:', error);
        res.status(500).send('認証に失敗しました');
    }
});
// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
