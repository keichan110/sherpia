const NOTION_API_BASE = 'https://api.notion.com/v1';

export type NotionDbId = string;
export type NotionConnectAccessToken = string;
export type NotionProperties = Record<string, unknown>;
export type NotionBlock = Record<string, unknown>;

/**
 * Notionデータベースにページを作成する。
 * @param databaseId 作成先のNotionデータベースID
 * @param properties ページに設定するNotionプロパティ
 * @param notionAccessToken Notion APIアクセストークン
 * @returns 作成されたNotionページID
 */
export function createPage(
  databaseId: NotionDbId,
  properties: NotionProperties,
  notionAccessToken: NotionConnectAccessToken
): string {
  const response = UrlFetchApp.fetch(
    `${NOTION_API_BASE}/pages`,
    notionFetchOptions('post', notionAccessToken, {
      parent: { database_id: databaseId },
      properties,
    })
  );

  assertOk(response);
  return (JSON.parse(response.getContentText()) as { id: string }).id;
}

/**
 * Notionデータベースを任意のクエリ条件で検索する。
 * @param databaseId 検索対象のNotionデータベースID
 * @param query Notion APIのdatabase queryリクエストボディ
 * @param notionAccessToken Notion APIアクセストークン
 * @returns Notion APIのdatabase queryレスポンス
 */
export function queryDatabase<TResponse = unknown>(
  databaseId: NotionDbId,
  query: object,
  notionAccessToken: NotionConnectAccessToken
): TResponse {
  const response = UrlFetchApp.fetch(
    `${NOTION_API_BASE}/databases/${databaseId}/query`,
    notionFetchOptions('post', notionAccessToken, query)
  );

  assertOk(response);
  return JSON.parse(response.getContentText()) as TResponse;
}

/**
 * Notionページのプロパティを更新する。
 * @param pageId 更新対象のNotionページID
 * @param properties 更新するNotionプロパティ
 * @param notionAccessToken Notion APIアクセストークン
 */
export function updatePage(
  pageId: string,
  properties: NotionProperties,
  notionAccessToken: NotionConnectAccessToken
): void {
  const response = UrlFetchApp.fetch(
    `${NOTION_API_BASE}/pages/${pageId}`,
    notionFetchOptions('patch', notionAccessToken, { properties })
  );
  assertOk(response);
}

/**
 * Notionページ配下にブロックを追加する。
 * @param pageId 追加先のNotionページID
 * @param children 追加するNotionブロック配列
 * @param notionAccessToken Notion APIアクセストークン
 */
export function appendBlockChildren(
  pageId: string,
  children: NotionBlock[],
  notionAccessToken: NotionConnectAccessToken
): void {
  const response = UrlFetchApp.fetch(
    `${NOTION_API_BASE}/blocks/${pageId}/children`,
    notionFetchOptions('patch', notionAccessToken, { children })
  );
  assertOk(response);
}

/**
 * Notion API呼び出し用のfetchオプションを生成する。
 * @param method HTTPメソッド（`'post'` または `'patch'`）
 * @param token Notion APIアクセストークン
 * @param payload リクエストボディとして送信するオブジェクト
 * @returns `UrlFetchApp.fetch` に渡すオプションオブジェクト
 */
function notionFetchOptions(
  method: 'post' | 'patch',
  token: NotionConnectAccessToken,
  payload: object
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
  return {
    method,
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
}

/**
 * Notion APIレスポンスのステータスコードを検証する。
 * @param response `UrlFetchApp.fetch` から返されたレスポンス
 * @throws ステータスコードが200以外の場合にエラーをスローする
 */
function assertOk(response: GoogleAppsScript.URL_Fetch.HTTPResponse): void {
  if (response.getResponseCode() !== 200) {
    throw new Error(`Notion API error: ${response.getContentText()}`);
  }
}
