import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import OpenAI from "openai";
import { CustomRequest } from "./types";

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
  upload.single("file"), // Blobは単一ファイルの場合が多いので、singleに変更
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

      let result: string;

      if (fileMimeType === "image/png") {
        // PNGファイルの場合
        console.log(`File ${req.file.originalname} is an image. Processing as PNG...`);

        // OCRで画像からテキストを抽出
        const extractedText = await processImage(req.file.path);

        console.log(`Extracted text from ${req.file.originalname}:`, extractedText);

        // テキスト化したデータを元にプロンプトを生成
        const prompt = generateCommand(subject, format, numQuestions, extractedText);

        // APIキーが必要な箇所
        console.log("About to call OpenAI API with prompt:", prompt);
        console.log("Using API Key:", process.env.OPENAI_API_KEY);

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
        });

        result = response.choices[0]?.message?.content || "No response";
        console.log(`Received answer for ${req.file.originalname}:`, result);
      } else {
        // その他のファイル（例: テキストやPDF）
        console.log(`File ${req.file.originalname} is not an image. Processing as text...`);
        const fileContent = await fs.readFile(req.file.path, "utf-8");
        const prompt = generateCommand(subject, format, numQuestions, fileContent);

        // APIキーが必要な箇所
        console.log("About to call OpenAI API with prompt:", prompt);
        console.log("Using API Key:", process.env.OPENAI_API_KEY);

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
        });

        result = response.choices[0]?.message?.content || "No response";
        console.log(`Received answer for ${req.file.originalname}:`, result);
      }

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
 * 画像処理（例: OCRでテキスト化）
 * @param filePath
 * @returns 抽出したテキスト
 */
async function processImage(filePath: string): Promise<string> {
  const extractedText = "Extracted text from image (dummy text)";
  console.log(`Processing image at ${filePath}. Extracted text:`, extractedText);
  return extractedText;
}

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
