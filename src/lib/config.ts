import type { GeminiApiKey, GeminiModel } from '../capabilities/gemini';
import type { NotionConnectAccessToken, NotionDbId } from '../capabilities/notion';

export type Config = {
  secretToken: string;
  geminiApiKey: GeminiApiKey;
  geminiModel: GeminiModel;
  notionAccessToken: NotionConnectAccessToken;
  notionDbId: NotionDbId;
  gmailCleanupLabels: string[];
};

export type SecretConfig = Pick<Config, 'secretToken'>;
export type GeminiConfig = Pick<Config, 'geminiApiKey' | 'geminiModel'>;
export type NotionConfig = Pick<Config, 'notionAccessToken' | 'notionDbId'>;
export type GmailCleanupConfig = Pick<Config, 'gmailCleanupLabels'>;

type ConfigSnapshot = Record<string, string>;

let _configSnapshotCache: ConfigSnapshot | null = null;

/**
 * GASスクリプトプロパティのスナップショットを一括取得し、1実行内で再利用する。
 * @returns キャッシュ済み、または新規取得したスクリプトプロパティ
 */
function getConfigSnapshot(): ConfigSnapshot {
  if (_configSnapshotCache) return _configSnapshotCache;
  _configSnapshotCache = PropertiesService.getScriptProperties().getProperties();
  return _configSnapshotCache;
}

/**
 * スクリプトプロパティのスナップショットをアプリケーション設定へ変換する。
 * @param snapshot スクリプトプロパティの一括取得結果
 * @returns デフォルト値を補完したアプリケーション設定
 */
function buildConfig(snapshot: ConfigSnapshot): Config {
  return {
    secretToken: snapshot.SECRET_TOKEN ?? '',
    geminiApiKey: snapshot.GEMINI_API_KEY ?? '',
    geminiModel: (snapshot.GEMINI_MODEL ?? 'gemini-3.1-flash-lite') as GeminiModel,
    notionAccessToken: snapshot.NOTION_ACCESS_TOKEN ?? '',
    notionDbId: snapshot.NOTION_DB_ID ?? '',
    gmailCleanupLabels: (snapshot.GMAIL_CLEANUP_LABELS ?? 'action,pending')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * GASスクリプトプロパティから全設定値を読み込んで返す。1実行内で一括取得結果がキャッシュされる。
 * @returns アプリケーション設定オブジェクト
 */
export function getConfig(): Config {
  return buildConfig(getConfigSnapshot());
}

/**
 * 認証用Secret設定をキャッシュ済みスクリプトプロパティから取得する。
 * @returns 認証用Secret設定
 */
export function getSecretConfig(): SecretConfig {
  const { secretToken } = buildConfig(getConfigSnapshot());
  return { secretToken };
}

/**
 * Gemini設定をキャッシュ済みスクリプトプロパティから取得する。
 * @returns Gemini APIキーとモデル名
 */
export function getGeminiConfig(): GeminiConfig {
  const { geminiApiKey, geminiModel } = buildConfig(getConfigSnapshot());
  return { geminiApiKey, geminiModel };
}

/**
 * Notion設定をキャッシュ済みスクリプトプロパティから取得する。
 * @returns Notion APIアクセストークンとデータベースID
 */
export function getNotionConfig(): NotionConfig {
  const { notionAccessToken, notionDbId } = buildConfig(getConfigSnapshot());
  return { notionAccessToken, notionDbId };
}

/**
 * Gmailラベル整理設定をキャッシュ済みスクリプトプロパティから取得する。
 * @returns Gmailラベル整理対象のラベル名配列
 */
export function getGmailCleanupConfig(): GmailCleanupConfig {
  const { gmailCleanupLabels } = buildConfig(getConfigSnapshot());
  return { gmailCleanupLabels };
}

/**
 * 設定キャッシュをクリアする。テスト用。
 */
export function resetConfigCache(): void {
  _configSnapshotCache = null;
}
