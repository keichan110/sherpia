/**
 * Gmailスレッドを検索する。
 * @param query Gmail検索クエリ
 * @returns 検索条件に一致したGmailスレッド配列
 */
export function searchThreads(query: string): GoogleAppsScript.Gmail.GmailThread[] {
  return GmailApp.search(query);
}

/**
 * Gmailスレッドから指定ラベルを外す。
 * @param thread ラベル削除対象のGmailスレッド
 * @param labelName 削除するユーザーラベル名
 * @returns なし
 */
export function removeLabelFromThread(
  thread: GoogleAppsScript.Gmail.GmailThread,
  labelName: string
): void {
  const label = GmailApp.getUserLabelByName(labelName);
  if (!label) return;

  thread.removeLabel(label);
}
