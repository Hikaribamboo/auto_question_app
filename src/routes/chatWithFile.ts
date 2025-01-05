import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import mammoth from "mammoth";
import OpenAI from "openai";
import { CustomRequest } from "./types";
import pdfParse from "pdf-parse"; // PDFをテキストに変換するために利用

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
  upload.single("file"),
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("Request received at /chat-with-files");

      if (!req.file) {
        console.warn("No file uploaded");
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }

      const { subject, format, numQuestions } = req.body;
      console.log("Request body:", { subject, format, numQuestions });

      if (!subject || !format || !numQuestions) {
        console.warn("Missing required fields: subject, format, or numQuestions");
        res.status(400).json({
          success: false,
          message: "Missing required fields: subject, format, or numQuestions",
        });
        return;
      }

      const fileMimeType = req.file.mimetype;
      console.log(`Uploaded file MIME type: ${fileMimeType}`);

      let fileContent: string;

      if (fileMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // DOCXファイルをテキストに変換
        const fileBuffer = await fs.readFile(req.file.path);
        const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
        fileContent = value.trim();
      } else if (fileMimeType === "application/pdf") {
        // PDFファイルをテキストに変換
        const fileBuffer = await fs.readFile(req.file.path);
        const pdfData = await pdfParse(fileBuffer);
        fileContent = pdfData.text.trim();
      } else {
        console.error("Unsupported file type:", fileMimeType);
        res.status(400).json({ success: false, message: "Unsupported file type" });
        return;
      }

      console.log(`Extracted text from file: ${fileContent.substring(0, 100)}...`); // 最初の100文字を表示

      // 命令文を生成
      const command = generateCommand(subject, format, numQuestions, fileContent);
      console.log("Generated command:", command);

      // ChatGPT API 呼び出し
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: command },
        ],
      });

      const result = chatResponse.choices[0]?.message?.content || "No response";
      console.log("ChatGPT response:", result);

      // 一時ファイルを削除
      await fs.unlink(req.file.path);
      console.log(`Temporary file ${req.file.originalname} deleted.`);

      res.status(200).json({ success: true, result });
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
