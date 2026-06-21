import { getMessagePlainBody, searchThreads } from '../../capabilities/gmail';
import { postMessage } from '../../capabilities/slack';
import { getGmailDigestConfig } from '../../lib/config';
import { log } from '../../lib/log';

const LOG_MOD = 'gmail-digest';

export type YesterdayWindow = { after: string; before: string };

/**
 * 指定時刻を基準にJSTで前日分のGmail検索日付範囲を返す。
 * @param now 基準時刻
 * @returns Gmail検索クエリに渡すafter/before日付
 */
export function getYesterdayWindow(now: Date): YesterdayWindow {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const todayJst = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate())
  );
  const yesterdayJst = new Date(todayJst.getTime() - 24 * 60 * 60 * 1000);
  return { after: fmtDate(yesterdayJst), before: fmtDate(todayJst) };
}

/**
 * 本文テキストのホワイトスペースを正規化し、指定文字数でトリムする。
 * @param body プレーンテキストの本文
 * @param maxLen トリムする最大文字数（デフォルト: 200）
 * @returns 正規化・トリム済みの本文冒頭
 */
export function truncateBody(body: string, maxLen = 200): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}

/**
 * 前日のNewsletterメールを検索し、件名と送信者の一覧をSlackへ投稿する。
 * @returns なし
 */
export function runGmailDigest(): void {
  const cfg = getGmailDigestConfig();
  const { after, before } = getYesterdayWindow(new Date());
  log.info(LOG_MOD, 'start', { after, before, label: cfg.gmailDigestLabel });
  let threads: GoogleAppsScript.Gmail.GmailThread[];
  try {
    threads = searchThreads(`label:${cfg.gmailDigestLabel} after:${after} before:${before}`);
  } catch (err) {
    log.error(LOG_MOD, 'gmail search failed', err);
    throw err;
  }
  const text = buildSlackText(threads);
  try {
    postMessage(cfg.slackBotToken, cfg.slackChannelId, text);
  } catch (err) {
    log.error(LOG_MOD, 'slack post failed', err);
    throw err;
  }
  log.info(LOG_MOD, 'done', { count: threads.length });
}

/**
 * DateをGmail検索用の日付文字列に変換する。
 * @param date 変換対象日付
 * @returns `yyyy/MM/dd` 形式の日付文字列
 */
function fmtDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * Gmailスレッド一覧からSlack投稿本文を組み立てる。
 * @param threads ダイジェスト対象のGmailスレッド配列
 * @returns Slackに投稿する本文
 */
function buildSlackText(threads: GoogleAppsScript.Gmail.GmailThread[]): string {
  if (threads.length === 0) return '本日のNewsletterはありません';
  const items = threads.map((thread) => {
    const msg = thread.getMessages()[0];
    const body = truncateBody(getMessagePlainBody(msg));
    return `• *${msg.getSubject()}*\n  ${msg.getFrom()}\n  ${body}`;
  });
  return `昨日のNewsletter (${threads.length}件)\n\n${items.join('\n\n')}`;
}
