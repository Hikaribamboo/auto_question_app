import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import OpenAI from 'openai';

const upload = multer({ dest: 'temp/' }); // 一時ファイル保存フォルダ
const router = Router();

router.post('/chat-with-file', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    // ファイルがアップロードされていない場合
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    // アップロードされたファイルの内容を取得
    const localFilePath = req.file.path;
    const fileContent = fs.readFileSync(localFilePath, 'utf-8');

    // OpenAIクライアントの初期化
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // .envにAPIキーを設定
    });

    // ChatGPT APIへのリクエスト
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // モデル名
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `以下のテキストを処理してください:\n\n${fileContent}` },
      ],
    });

    // ChatGPTからの応答を取得
    const answer = response.choices[0]?.message?.content || '';

    // 一時ファイルを削除
    fs.unlinkSync(localFilePath);

    // 成功レスポンスを返す
    res.status(200).json({ success: true, answer });
  } catch (err) {
    console.error('Error in /chat-with-file:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

export default router;
