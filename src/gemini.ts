import { type Config } from './config';

export type GeminiResult = {
  title: string;
  tldr: string;
  summary: string;
  category: string;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
};

const PROMPT_TEMPLATE = (articleText: string) => `あなたはITエンジニア向けのナレッジキュレーターです。
以下の記事本文を分析し、JSONのみを返してください。前置きやコードブロック記号は不要です。

記事本文:
${articleText}

以下のJSON形式で返してください:
{
  "title": "記事タイトル（元タイトルが適切なら流用）",
  "tldr": "60文字以内。1文目：何の記事か。2文目：なぜ重要か",
  "summary": "200〜300文字。技術背景・経緯を含む詳細要約",
  "category": "AI/ML、開発、インフラ、セキュリティ、ビジネス、ツール、マネジメント、自己啓発、その他 のいずれか1つ",
  "tags": ["固有名詞・技術名を優先した3〜5個のキーワード"],
  "confidence": "high/medium/low（本文の情報量の自己評価）"
}`;

export function callGeminiAPI(articleText: string, config: Config): GeminiResult {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  const payload = {
    contents: [{ parts: [{ text: PROMPT_TEMPLATE(articleText) }] }],
    generationConfig: { temperature: 0.3 },
  };

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const match = text.match(/{[\s\S]*}/);
  if (!match) throw new Error('Gemini returned invalid JSON');

  return JSON.parse(match[0]) as GeminiResult;
}
