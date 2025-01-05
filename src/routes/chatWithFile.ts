import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import OpenAI from "openai";
import { CustomRequest } from "./types"; // あなたが定義したCustomRequestをインポート

// 環境変数の読み込み
import dotenv from "dotenv";
dotenv.config();

console.log("API Key used for OpenAI:", process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

console.log("OpenAI instance initialized:", openai);

const upload = multer({ dest: "temp/" });
const router = Router();

router.post(
  "/chat-with-files",
  upload.array("files"),
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("Request received at /chat-with-files");

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        console.warn("No files uploaded");
        res.status(400).json({ success: false, message: "No files uploaded" });
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

      let filesArray: Express.Multer.File[] = [];
      if (Array.isArray(req.files)) {
        filesArray = req.files;
      } else {
        filesArray = Object.values(req.files).flat();
      }

      console.log("Uploaded files:", filesArray.map((file) => file.originalname));

      const results: string[] = [];

      for (const file of filesArray) {
        try {
          console.log(`Processing file: ${file.originalname}`);
          const fileContent = await fs.readFile(file.path, "utf-8");
          const prompt = generateCommand(subject, format, numQuestions, fileContent);
          console.log(`Generated prompt for ${file.originalname}:`, prompt);

          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: prompt },
            ],
          });

          const answer = response.choices[0]?.message?.content || "No response";
          console.log(`Received answer for ${file.originalname}:`, answer);

          results.push(answer);
          await fs.unlink(file.path);
          console.log(`Temporary file ${file.originalname} deleted.`);
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
        }
      }

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
