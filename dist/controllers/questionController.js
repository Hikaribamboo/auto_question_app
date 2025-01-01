"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuestion = void 0;
const questionService_1 = require("../services/questionService");
const generateQuestion = async (req, res) => {
    try {
        const { category, difficulty, numberOfQuestions } = req.body;
        // サービス層で問題を生成
        const questions = await (0, questionService_1.createQuestions)({
            category,
            difficulty,
            numberOfQuestions
        });
        // 成功レスポンスを返す（return不要）
        res.status(200).json({
            success: true,
            data: questions
        });
    }
    catch (error) {
        console.error('Error generating questions:', error);
        // エラーレスポンス（ここもreturn不要）
        res.status(500).json({
            success: false,
            message: '質問生成中にエラーが発生しました'
        });
    }
};
exports.generateQuestion = generateQuestion;
