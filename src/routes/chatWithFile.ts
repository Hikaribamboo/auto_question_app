import { Router, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import mammoth from "mammoth";
import OpenAI from "openai";
import { CustomRequest } from "./types";
import pdfParse from "pdf-parse"; // PDFをテキストに変換するために利用
import Tesseract from "tesseract.js"; // OCRライブラリのインポート

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

      if (fileMimeType === "image/png") {
        console.log(`File ${req.file.originalname} is a PNG image. Performing OCR...`);
      
        try {
          // Tesseract.jsを使って画像からテキストを抽出
          const { data: { text } } = await Tesseract.recognize(req.file.path, "jpn", {
            langPath: "./tessdata", // ダウンロードした日本語データへのパス
          });
      
          console.log(`Extracted text from ${req.file.originalname}:`, text);
          fileContent = text.trim();
        } catch (ocrError) {
          console.error("Error performing OCR:", ocrError);
          res.status(500).json({ success: false, message: "Error processing image file" });
          return;
        }
      } else if (fileMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
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
      // 一時ファイルを削除
      await fs.unlink(req.file.path);

      const tableData = processChatResponse(result)

      // JSON形式で返す
      res.status(200).json({
        success: true,
        tableData, // CSVデータとして返す
      });
    } catch (err) {
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
  const baseCommand = `
    Please create ${numQuestions} ${subject} questions according to the following format.
    Question format: ${format}.
    Number of questions: ${numQuestions}.
    File contents: ${fileContent}
  `;

  const sharedFourChoiceCommand = `
    Name the columns question, answer, a, b, and c. 
    Don't reuse the same words too much, and make b, c, and d words that can't be answers. 
    Also, don't use words that are too simple.
  `;

  if (subject === "英語" && format === "四択（語彙）") {
    return `
      ${baseCommand}
      Create one question for each English word in the attached file.
      Avoid using the same words in multiple choices.
      ${sharedFourChoiceCommand}
    `;
  } else if (subject === "英語" && format === "四択（文法）") {
    return `
      ${baseCommand}
      Learn the grammar of the attached file and create questions from its contents.
      Avoid using content with the same distribution.
      ${sharedFourChoiceCommand}
    `;
  }

  // デフォルト命令文（その他の科目や形式）
  return `
    ${baseCommand}
    Based on the contents of the attached file.
  `;
}

async function processChatResponse(response: string): Promise<{ question: string; answer: string; a: string; b: string; c: string }[]> {
  try {
    // 1. JSON形式のレスポンスをパース
    const responseObject = JSON.parse(response);

    // 2. "result"フィールドを抽出
    if (!responseObject.success || !responseObject.result) {
      throw new Error("Invalid response format. 'success' or 'result' field is missing.");
    }

    const resultText: string = responseObject.result;

    // 3. "result"を処理して表形式に変換
    const rows: { question: string; answer: string; a: string; b: string; c: string }[] = [];
    const lines: string[] = resultText.split("\n").filter((line: string) => line.trim() !== "");

    let currentRow: { question?: string; answer?: string; a?: string; b?: string; c?: string } = {};

    lines.forEach((line: string) => {
      if (line.startsWith("Question")) {
        if (currentRow.question) {
          rows.push(currentRow as { question: string; answer: string; a: string; b: string; c: string });
          currentRow = {};
        }
        currentRow.question = line.replace(/^Question \d+: /, "").trim();
      } else if (line.startsWith("a)")) {
        currentRow.a = line.replace(/^a\)/, "").trim();
      } else if (line.startsWith("b)")) {
        currentRow.b = line.replace(/^b\)/, "").trim();
      } else if (line.startsWith("c)")) {
        currentRow.c = line.replace(/^c\)/, "").trim();
      } else if (line.startsWith("d)")) {
        currentRow.answer = line.replace(/^d\)/, "").trim();
      }
    });

    // 最後の行を追加
    if (currentRow.question) {
      rows.push(currentRow as { question: string; answer: string; a: string; b: string; c: string });
    }

    return rows;
  } catch (error) {
    console.error("Error processing chat response:", error);
    throw error;
  }
}


export default router;
