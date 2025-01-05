import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import OpenAI from "openai";
import { CustomRequest } from "./types";
import mammoth from "mammoth"; // .docx の解析用ライブラリ

// 環境変数の読み込み
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const upload = multer({ dest: "temp/" });
const router = Router();

router.post(
  "/chat-with-files",
  upload.single("file"), // 1つのファイルをアップロード
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("リクエストを受信しました: /chat-with-files");

      // アップロードされたファイルがあるか確認
      if (!req.file) {
        console.warn("ファイルがアップロードされていません");
        res.status(400).json({ success: false, message: "ファイルがアップロードされていません" });
        return;
      }

      // リクエストのパラメータを確認
      const { subject, format, numQuestions } = req.body;
      console.log("リクエストボディ:", { subject, format, numQuestions });

      if (!subject || !format || !numQuestions) {
        console.warn("必要なフィールドが不足しています: subject, format, numQuestions");
        res.status(400).json({
          success: false,
          message: "必要なフィールドが不足しています: subject, format, numQuestions",
        });
        return;
      }

      // アップロードされたファイルのMIMEタイプを取得
      const fileMimeType = req.file.mimetype;
      console.log(`アップロードされたファイルのMIMEタイプ: ${fileMimeType}`);

      let fileContent: string;
      let result: string;

      if (fileMimeType === "text/plain") {
        // テキストファイルの場合
        console.log(`テキストファイルを処理中: ${req.file.originalname}`);
        fileContent = await fs.readFile(req.file.path, "utf-8");

      } else if (fileMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // .docx ファイルの場合
        console.log(`.docx ファイルを処理中: ${req.file.originalname}`);
        const docxBuffer = await fs.readFile(req.file.path);
        const docxText = await mammoth.extractRawText({ buffer: docxBuffer });
        fileContent = docxText.value;
      } else {
        // サポートされていないファイルタイプの場合
        console.error(`サポートされていないファイルタイプ: ${fileMimeType}`);
        res.status(400).json({ success: false, message: "サポートされていないファイルタイプです" });
        return;
      }

      console.log(`ファイル内容:\n${fileContent.slice(0, 100)}...`); // 内容の一部をログに出力

      // 命令文を生成
      const command = generateCommand(subject, format, numQuestions, fileContent);
      console.log("生成された命令文:", command);

      // ChatGPT API にリクエストを送信
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: command },
        ],
      });

      result = chatResponse.choices[0]?.message?.content || "No response";
      console.log(`ChatGPTの応答: ${result}`);

      // 一時ファイルを削除
      await fs.unlink(req.file.path);
      console.log(`一時ファイル ${req.file.originalname} を削除しました。`);

      res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("エラー発生: /chat-with-files:", err);
      res.status(500).json({ success: false, message: "内部サーバーエラーが発生しました" });
    }
  }
);

/**
 * 命令文を生成する関数
 */
function generateCommand(
  subject: string,
  format: string,
  numQuestions: string,
  fileContent: string
): string {
  // 例: 英語の語彙問題
  if (subject === "英語" && format === "語彙") {
    return `
      Please create ${numQuestions} English vocabulary questions based on the following text:
      ${fileContent}
      Name the columns question, answer, a, b, and c.
      Don't reuse the same words too much, and make b, c, and d words that can't be answers.
    `;
  } else if (subject === "英語" && format === "文法") {
    return `
      Please create ${numQuestions} English grammar questions based on the following text:
      ${fileContent}
      Name the columns question, answer, a, b, and c.
      Don't reuse the same content too much, and make b, c, and d options incorrect.
    `;
  }

  // その他のデフォルト
  return `
    Please create ${numQuestions} ${subject} questions in the format: ${format}.
    Based on the following text:
    ${fileContent}
  `;
}

export default router;
