"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuestions = void 0;
const createQuestions = async (params) => {
    const { category, difficulty, numberOfQuestions = 5 } = params;
    const questions = [];
    for (let i = 1; i <= numberOfQuestions; i++) {
        questions.push({
            id: i,
            text: `[${category || '一般'} - ${difficulty || '普通'}] 問題文サンプル${i}`,
            options: ['選択肢A', '選択肢B', '選択肢C', '選択肢D'],
            answer: '選択肢A'
        });
    }
    return questions;
};
exports.createQuestions = createQuestions;
