/**
 * GASのHTTPレスポンスオブジェクトを生成する。
 * @param success 処理成功フラグ
 * @param message レスポンスメッセージ
 * @returns JSON形式のテキストレスポンス
 */
export function createResponse(
  success: boolean,
  message: string
): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify({ success, message })).setMimeType(
    ContentService.MimeType.JSON
  );
}
