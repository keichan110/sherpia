const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const RETRYABLE_STATUSES = [503];

const PROMPT_TEMPLATE = (
  articleText: string
) => `あなたはITエンジニア向けのナレッジキュレーターです。記事本文を読み、指定のJSON形式に構造化して出力してください。

# 出力ルール
- 出力はJSONオブジェクトのみ。前置き・説明文・コードブロック記号（\`\`\`）を一切含めない。
- すべてのフィールドを必ず埋める。

# フィールド別ルール
- title: 記事のタイトル。元タイトルが適切ならそのまま使う。
- overview: この記事が何についての記事かを1文で説明する。記事に書かれた事実のみを書き、重要性・価値の判断・推測は書かない。
- summary: 見出し(heading)と本文(body)のオブジェクトの配列。次のルールに従う。
  1. 記事の章立て・話題の流れに沿って分割し、重要な情報を省略しない。セクション数は記事の内容に応じて決める。
  2. heading は記事の章立てや話題の流れに沿った見出しにする。
  3. body はその節の内容を詳述する。手順がある場合は全ステップを省略せず列挙する。
  4. body には数値・ベンチマーク・具体的な設定値があれば必ず含める。
  5. body には理由や背景が記事に書かれている場合は省略しない。
  6. body 内の箇条書きは「・」区切りで書いてよい。
  7. 1つの body が2000文字を大きく超えそうな場合は、情報を省略せず、話題の区切りで heading を分けて複数の要素に分割する。
- category: 次の中から最も近いものを1つだけ選ぶ。AI/ML / 開発 / インフラ / セキュリティ / ビジネス / ツール / マネジメント / 自己啓発 / その他
- tags: 固有名詞・技術名を優先した3〜5個のキーワード。

# JSON形式
{
  "title": "string",
  "overview": "string",
  "summary": [{ "heading": "string", "body": "string" }],
  "category": "string",
  "tags": ["string"]
}

# 記事本文
"""
${articleText}
"""`;

export type GeminiModel =
  | 'gemini-3.5-flash'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-pro';
export type GeminiApiKey = string;

export type SummarySection = {
  heading: string;
  body: string;
};

export type GeminiResult = {
  title: string;
  overview: string;
  summary: SummarySection[];
  category: string;
  tags: string[];
};

/**
 * Gemini APIに記事本文を送信し、要約・構造化した結果を返す。
 * 503エラーは指数バックオフで最大3回リトライする。429エラーはリトライせず即座にエラーを投げる。
 * @param articleText 要約対象の記事本文
 * @param geminiModel 使用するGeminiモデル名
 * @param geminiApiKey Gemini APIキー
 * @returns 要約・構造化された `GeminiResult`
 * @throws Gemini APIが有効なJSONを返さない場合、またはリトライ上限を超えた場合
 */
export function callGeminiAPI(
  articleText: string,
  geminiModel: GeminiModel,
  geminiApiKey: GeminiApiKey
): GeminiResult {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [{ parts: [{ text: PROMPT_TEMPLATE(articleText) }] }],
    generationConfig: { temperature: 0.3 },
  };

  const options = {
    method: 'post' as const,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = UrlFetchApp.fetch(endpoint, options);
    const status = response.getResponseCode();

    if (status === 200) {
      const result = JSON.parse(response.getContentText()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      const match = text.match(/{[\s\S]*}/);
      if (!match) {
        throw new Error('Gemini returned invalid JSON');
      }

      return JSON.parse(match[0]) as GeminiResult;
    }

    if (RETRYABLE_STATUSES.includes(status) && attempt < MAX_RETRIES) {
      Utilities.sleep(backoffMs);
      backoffMs *= 2;
      continue;
    }

    throw new Error(`Gemini API error: HTTP ${status}`);
  }

  throw new Error('Gemini API error: max retries exceeded');
}
