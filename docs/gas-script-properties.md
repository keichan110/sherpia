# スクリプトプロパティの管理

設定値・APIキーはすべてGASのスクリプトプロパティで管理する。
各プロパティの登録手順は `docs/google-app-script-setup.md` を参照。

## 管理するプロパティ一覧

| プロパティ名 | 用途 |
|---|---|
| `SECRET_TOKEN` | Webhookリクエストの認証トークン |
| `GEMINI_API_KEY` | Gemini API の認証キー |
| `GEMINI_MODEL` | 使用するGeminiモデル名（省略時はデフォルト値を使用） |
| `NOTION_ACCESS_TOKEN` | Notion APIのアクセストークン |
| `NOTION_DB_ID` | 保存先NotionデータベースのID |

## コードからのアクセス方法

**必ず `src/config.ts` の `getConfig()` を経由して取得すること。**
`PropertiesService` を直接呼び出すことは禁止。

```ts
// ✅ 正しい
import { getConfig } from './config';
const { geminiApiKey, notionDbId } = getConfig();

// ❌ 誤り: PropertiesService の直接呼び出し
const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
```

## ハードコード禁止

APIキーや認証情報をソースコードに直接書くことは禁止。
`.clasp.json` はgit管理外（`.gitignore` に記載）であり、スクリプトプロパティはGASコンソールで管理する。
