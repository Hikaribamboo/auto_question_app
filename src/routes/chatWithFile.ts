import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import OpenAI from "openai";
import { CustomRequest } from "./types"; // あなたが定義したCustomRequestをインポート

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const upload = multer({ dest: "temp/" });
const router = Router();

router.post(
  "/chat-with-files",
  upload.array("files"), // <input name="files" multiple>
  async (req: CustomRequest, res: Response) => {
    try {
      // ファイルがない
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        // 「return res.status(...).json(...)」ではなく、
        // まず res.status(...).json(...) を呼び出し、その後に単独で return;
        res.status(400).json({ success: false, message: "No files uploaded" });
        return;
      }

      // body が不完全
      const { subject, format, numQuestions } = req.body;
      if (!subject || !format || !numQuestions) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: subject, format, or numQuestions",
        });
        return;
      }

      // req.files が配列かオブジェクトかで分ける
      let filesArray: Express.Multer.File[] = [];
      if (Array.isArray(req.files)) {
        filesArray = req.files;
      } else {
        filesArray = Object.values(req.files).flat();
      }

      const results: string[] = [];

      for (const file of filesArray) {
        // ファイル内容を読み込み（UTF-8）
        const fileContent = await fs.readFile(file.path, "utf-8");

        // subject/format/numQuestions に基づいて命令文を生成
        const prompt = generateCommand(subject, format, numQuestions, fileContent);

        // ChatGPT に送信
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
        });

        const answer = response.choices[0]?.message?.content || "No response";
        results.push(answer);

        // 一時ファイル削除
        await fs.unlink(file.path);
      }

      // 処理が終わったらクライアントに返す
      res.status(200).json({ success: true, results });
    } catch (err) {
      console.error("Error in /chat-with-files:", err);
      res.status(500).json({ success: false, message: "Internal Server Error" });
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
