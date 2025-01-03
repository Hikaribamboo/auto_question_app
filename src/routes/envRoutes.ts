import { Router } from "express";

const router = Router();

// 環境変数をクライアントに渡すエンドポイント
router.get("/env", (req, res) => {
  res.json({
    clientId: process.env.CLIENT_ID,
    apiKey: process.env.API_KEY, // 必要なものだけ渡す
  });
});

export default router;
