import axios from 'axios';

// レスポンス型を定義
interface OpenAIResponse {
    choices: {
      message: {
        content: string;
      };
    }[];
  }

interface QuestionRequest {
  category?: string;
  difficulty?: string;
  numberOfQuestions?: number;
}

interface Question {
  id: number;
  text: string;
  options?: string[];
  answer?: string;
}

export const createQuestions = async (params: QuestionRequest): Promise<Question[]> => {
  const { category = '一般', difficulty = '普通', numberOfQuestions = 5 } = params;

  // OpenAIに投げるプロンプト例（ChatGPTに英語で指示）
  const prompt = `Please generate ${numberOfQuestions} ${difficulty}-level questions about ${category}. 
  Provide four multiple choice options for each question and indicate the correct answer.`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not defined in .env');
  }

  // ChatGPT API呼び出し例 (GPT-3.5の場合)
  const response = await axios.post<OpenAIResponse>(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      }
    }
  );

  // レスポンスからテキストを取り出す
  const content = response.data.choices[0].message.content as string;

  // contentをパースしてquestions配列にする処理（要工夫）
  // 今回はサンプルとして適当に返す
  const questions: Question[] = [
    {
      id: 1,
      text: content,
      options: ['選択肢A', '選択肢B', '選択肢C', '選択肢D'],
      answer: '選択肢A'
    }
  ];

  return questions;
};

  