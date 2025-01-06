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
  upload.array("files"), // 複数ファイルを受け取る
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("Request received at /chat-with-files");

      if (!req.files || req.files.length === 0) {
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

      const numQuestionsInt = parseInt(numQuestions, 10);
      if (isNaN(numQuestionsInt) || numQuestionsInt <= 0) {
        res.status(400).json({ success: false, message: "Invalid numQuestions value" });
        return;
      }

      // テキスト化された全ファイルの内容を結合
      let combinedText = "";
      // req.files の型を確認して配列として扱えるようにキャスト
      if (Array.isArray(req.files)) {
        for (const file of req.files as Express.Multer.File[]) {
          const fileMimeType = file.mimetype;
          console.log(`Processing file: ${file.originalname}, MIME type: ${fileMimeType}`);

          let fileContent = "";

          if (fileMimeType === "image/png") {
            const { data: { text } } = await Tesseract.recognize(file.path, "jpn", {
              langPath: "./tessdata",
            });
            fileContent = text.trim();
          } else if (fileMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const fileBuffer = await fs.readFile(file.path);
            const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
            fileContent = value.trim();
          } else if (fileMimeType === "application/pdf") {
            const fileBuffer = await fs.readFile(file.path);
            const pdfData = await pdfParse(fileBuffer);
            fileContent = pdfData.text.trim();
          } else {
            console.warn("Unsupported file type:", fileMimeType);
            res.status(400).json({ success: false, message: "Unsupported file type" });
            return;
          }

          console.log(`Extracted text from file: ${fileContent.substring(0, 100)}...`); // 最初の100文字を表示
          combinedText += fileContent + "\n"; // 結合
        }
      } else {
        console.error("req.files is not an array.");
        res.status(400).json({ success: false, message: "No valid files uploaded" });
        return;
      }
      console.log(combinedText)
      // 作問回数を計算
      const maxQuestionsPerRequest = 10;
      const numRequests = Math.ceil(numQuestionsInt / maxQuestionsPerRequest); // 商＋1で計算

      // 分割された結果を保持する配列
      let allQuestions: { question: string; answer: string; a: string; b: string; c: string }[] = [];

      // テキストを等分に分割
      const splitTexts = combinedText.split(/\s+/); // 空白で分割
      const chunkSize = Math.ceil(splitTexts.length / numRequests);

      for (let i = 0; i < numRequests; i++) {
        const chunk = splitTexts.slice(i * chunkSize, (i + 1) * chunkSize).join(" ");

        // 今回のリクエストで作問する数
        const questionsToRequest = Math.min(
          maxQuestionsPerRequest,
          numQuestionsInt - i * maxQuestionsPerRequest
        ).toString(); // 数値を文字列に変換        

        const command = generateCommand(subject, format, questionsToRequest, chunk);
        console.log(`Generated command for batch ${i + 1}:`, command);

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini-2024-07-18",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: command },
          ],
        });

        if (!chatResponse.choices || chatResponse.choices.length === 0) {
          throw new Error("Invalid response from ChatGPT API.");
        }

        const result = chatResponse.choices[0]?.message?.content || "";
        const tableData = await processChatResponse([result]); // `result` を配列に変換して渡す
        allQuestions = allQuestions.concat(tableData);

      }

      // 最終結果をクライアントに返却
      res.status(200).json({
        success: true,
        tableData: allQuestions,
      });
    } catch (err) {
      console.error("Error processing request:", err);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
);

export default router;

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
    Ensure all questions are fill-in-the-blank style multiple-choice questions.
    Use the provided content to generate realistic and challenging distractors (a, b, c) that are not correct answers.
    Avoid reusing the same options across questions, and ensure that the questions are varied.
    Also, avoid using overly simple or trivial options as distractors.
    Format the output as a **valid JSON array** with the following structure:
    [
      {
        "question": "Question text here",
        "answer": "Correct answer here",
        "a": "Option a here",
        "b": "Option b here",
        "c": "Option c here"
      },
      ...
    ]
    Ensure the output is **strictly valid JSON** and does not include any additional text outside the JSON format.
  `;

if (subject === "英語" && format === "四択（語彙）") {
  return `
    ${baseCommand}
    Create one fill-in-the-blank vocabulary question for each English word in the attached file.
    Use synonyms or related meanings as distractors (a, b, c).
    ${sharedFourChoiceCommand}
  `;
} else if (subject === "英語" && format === "四択（文法）") {
  return `
    ${baseCommand}
    Use the grammar rules and examples in the attached file to create fill-in-the-blank multiple-choice questions.
    Ensure the blanks target specific grammatical rules or structures, such as verb tense, subject-verb agreement, or conjunction usage.
    example: [
      {
        "question": "I wish we ______ the project earlier.",
        "answer": "had completed",
        "a": " completed",
        "b": "will complete",
        "c": "have completed"
      },
      ...
    ]
    ${sharedFourChoiceCommand}
  `;
}


  // デフォルト命令文（その他の科目や形式）
  return `
    ${baseCommand}
    Based on the contents of the attached file.
  `;
}

async function processChatResponse(responses: string[]): Promise<{ question: string; answer: string; a: string; b: string; c: string }[]> {
  try {
    let allRows: { question: string; answer: string; a: string; b: string; c: string }[] = []; // すべての行を格納する配列

    // 各レスポンスを処理
    responses.forEach((response, index) => {
      try {
        const jsonStartIndex = response.indexOf("[");
        const jsonEndIndex = response.lastIndexOf("]");

        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
          throw new Error(`Valid JSON not found in response ${index + 1}`);
        }

        const jsonString = response.substring(jsonStartIndex, jsonEndIndex + 1);
        const rows: { question: string; answer: string; a: string; b: string; c: string }[] = JSON.parse(jsonString);

        // 必須フィールドのチェック
        rows.forEach((row, rowIndex) => {
          if (!row.question || !row.answer || !row.a || !row.b || !row.c) {
            throw new Error(
              `Missing required fields in response ${index + 1}, row ${rowIndex + 1}`
            );
          }
        });

        allRows = allRows.concat(rows); // データを結合
      } catch (error) {
        console.error(`Error processing response ${index + 1}:`, error);
      }
    });

    return allRows;
  } catch (error) {
    console.error("Error processing multiple chat responses:", error);
    throw error;
  }
}
