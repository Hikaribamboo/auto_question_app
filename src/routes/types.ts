// types.ts
import { Request } from "express";

export interface CustomRequest extends Request {
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  body: {
    subject?: string;
    format?: string;
    numQuestions?: string;
  };
}
