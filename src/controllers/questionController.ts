import { Request, Response } from 'express';
import { createQuestions } from '../services/questionService';

export const generateQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, difficulty, numberOfQuestions } = req.body;

    // サービス層で問題を生成
    const questions = await createQuestions({
      category,
      difficulty,
      numberOfQuestions
    });

    // 成功レスポンスを返す（return不要）
    res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    // エラーレスポンス（ここもreturn不要）
    res.status(500).json({
      success: false,
      message: '質問生成中にエラーが発生しました'
    });
  }
};
