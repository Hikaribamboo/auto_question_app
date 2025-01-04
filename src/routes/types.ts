// types.ts

import { Request } from "express";
import { Multer } from "multer";

// ボディに含まれる項目の型
export interface MyRequestBody {
  subject: string;
  format: string;
  numQuestions: string;
}

// カスタムリクエスト型 (multer.array("files") を想定)
export interface CustomRequest extends Request<{}, any, MyRequestBody> {
  // multer が付与するプロパティ
  // array(...) の場合、実際には File[] | { [fieldname: string]: File[] } | undefined
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}
