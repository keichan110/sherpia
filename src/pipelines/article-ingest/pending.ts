import {
  appendBlockChildren,
  createPage,
  type NotionBlock,
  type NotionConnectAccessToken,
  type NotionDbId,
  type NotionProperties,
  queryDatabase,
  updatePage,
} from '../../capabilities/notion';
import type { GeminiResult } from './gemini';

const MAX_RICH_TEXT_LENGTH = 2000;

export type PendingRecord = {
  id: string;
  url: string;
  retryCount: number;
};

/**
 * URLが既にarticle-ingestのNotionデータベースに登録済みの場合にスローされるエラー。
 */
export class DuplicateUrlError extends Error {
  constructor(url: string) {
    super(`URL already registered: ${url}`);
    this.name = 'DuplicateUrlError';
  }
}

/**
 * article-ingestの未処理記事フラグが立っているか確認する。
 * @returns フラグが `"true"` のとき `true`、それ以外は `false`
 */
export function hasPendingArticles(): boolean {
  return PropertiesService.getScriptProperties().getProperty('HAS_PENDING') === 'true';
}

/**
 * article-ingestの未処理記事フラグを削除する。
 */
export function clearPendingArticlesFlag(): void {
  PropertiesService.getScriptProperties().setProperty('HAS_PENDING', 'false');
}

/**
 * URLとステータス「処理待ち」でNotionにarticle-ingest用レコードを仮登録する。
 * @param url 保存対象の記事URL
 * @param notionDbId 保存先NotionデータベースID
 * @param notionAccessToken Notion APIアクセストークン
 * @returns 作成されたNotionページID
 * @throws {DuplicateUrlError} URLが既に登録済みの場合
 */
export function createPendingRecord(
  url: string,
  notionDbId: NotionDbId,
  notionAccessToken: NotionConnectAccessToken
): string {
  if (isUrlRegistered(url, notionDbId, notionAccessToken)) throw new DuplicateUrlError(url);

  return createPage(
    notionDbId,
    {
      URL: { url },
      // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
      ['ステータス']: { select: { name: '処理待ち' } },
      // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
      ['リトライ回数']: { number: 0 },
    },
    notionAccessToken
  );
}

/**
 * URLをarticle-ingest用Notionレコードとして仮登録し、未処理記事フラグを立てる。
 * @param url 保存対象の記事URL
 * @param notionDbId 保存先NotionデータベースID
 * @param notionAccessToken Notion APIアクセストークン
 * @returns 作成されたNotionページID
 * @throws {DuplicateUrlError} URLが既に登録済みの場合
 */
export function registerPendingRecord(
  url: string,
  notionDbId: NotionDbId,
  notionAccessToken: NotionConnectAccessToken
): string {
  const pageId = createPendingRecord(url, notionDbId, notionAccessToken);
  PropertiesService.getScriptProperties().setProperty('HAS_PENDING', 'true');
  return pageId;
}

/**
 * ステータスが「処理待ち」のarticle-ingest用レコードをリトライ回数昇順・作成日昇順で1件取得する。
 * @param notionDbId 検索対象のNotionデータベースID
 * @param notionAccessToken Notion APIアクセストークン
 * @returns ページID・URL・リトライ回数のオブジェクト。該当レコードがなければ `null`
 */
export function queryPendingRecord(
  notionDbId: NotionDbId,
  notionAccessToken: NotionConnectAccessToken
): PendingRecord | null {
  const result = queryDatabase<{
    results: {
      id: string;
      properties: {
        URL?: { url?: string };
        // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
        ['リトライ回数']?: { number?: number };
      };
    }[];
  }>(
    notionDbId,
    {
      filter: {
        property: 'ステータス',
        select: { equals: '処理待ち' },
      },
      sorts: [
        { property: 'リトライ回数', direction: 'ascending' },
        { timestamp: 'created_time', direction: 'ascending' },
      ],
      page_size: 1,
    },
    notionAccessToken
  );

  if (result.results.length === 0) return null;

  const page = result.results[0];
  return {
    id: page.id,
    url: page.properties.URL?.url ?? '',
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    retryCount: page.properties['リトライ回数']?.number ?? 0,
  };
}

/**
 * article-ingest用レコードのリトライ回数を1加算する。ステータスは変更しない。
 * @param pageId 更新対象のNotionページID
 * @param currentRetryCount 現在のリトライ回数
 * @param notionAccessToken Notion APIアクセストークン
 */
export function incrementRetryCount(
  pageId: string,
  currentRetryCount: number,
  notionAccessToken: NotionConnectAccessToken
): void {
  updatePage(
    pageId,
    {
      // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
      ['リトライ回数']: { number: currentRetryCount + 1 },
    },
    notionAccessToken
  );
}

/**
 * 既存のarticle-ingest用NotionレコードをGeminiの要約結果で更新する。
 * @param pageId 更新対象のNotionページID
 * @param data Geminiの要約結果。`status` が `'エラー'` の場合は `null` を渡す
 * @param status 更新後のステータス（`'完了'` または `'エラー'`）
 * @param notionAccessToken Notion APIアクセストークン
 */
export function updateRecord(
  pageId: string,
  data: GeminiResult | null,
  status: '完了' | 'エラー',
  notionAccessToken: NotionConnectAccessToken
): void {
  const properties: NotionProperties = {
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    ['ステータス']: { select: { name: status } },
  };

  if (status === '完了' && data) {
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    properties['タイトル'] = { title: [{ text: { content: data.title } }] };
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    properties['既読'] = { checkbox: false };
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    properties['カテゴリー'] = { select: { name: data.category } };
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    properties['タグ'] = { multi_select: data.tags.map((tag) => ({ name: tag })) };
  }

  updatePage(pageId, properties, notionAccessToken);

  if (status === '完了' && data) {
    appendBlockChildren(pageId, articleSummaryBlocks(data), notionAccessToken);
  }
}

function isUrlRegistered(
  url: string,
  notionDbId: NotionDbId,
  notionAccessToken: NotionConnectAccessToken
): boolean {
  const result = queryDatabase<{ results: unknown[] }>(
    notionDbId,
    {
      filter: {
        property: 'URL',
        url: { equals: url },
      },
      page_size: 1,
    },
    notionAccessToken
  );

  return result.results.length > 0;
}

function articleSummaryBlocks(data: GeminiResult): NotionBlock[] {
  return [
    ...splitTextToBlocks(data.overview),
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: '要約' } }] },
    },
    ...data.summary.flatMap((section) => [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: section.heading } }] },
      },
      ...splitTextToBlocks(section.body),
    ]),
  ];
}

function splitTextToBlocks(text: string, maxLen = MAX_RICH_TEXT_LENGTH): NotionBlock[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    const newlineBoundary = remaining.lastIndexOf('\n', maxLen - 1);
    const periodBoundary = remaining.lastIndexOf('。', maxLen - 1);
    const boundary =
      newlineBoundary > 0 ? newlineBoundary + 1 : periodBoundary > 0 ? periodBoundary + 1 : maxLen;

    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary);
  }
  if (remaining) chunks.push(remaining);

  return chunks.map((chunk) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] },
  }));
}
