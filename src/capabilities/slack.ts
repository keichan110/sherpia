export type SlackBotToken = string & { readonly __brand: 'SlackBotToken' };
export type SlackChannelId = string & { readonly __brand: 'SlackChannelId' };

/**
 * Slack Web API `chat.postMessage` でメッセージを投稿する。
 * @param botToken Slack Bot User OAuth Token
 * @param channel 投稿先SlackチャンネルID
 * @param text 投稿する本文
 * @returns なし
 */
export function postMessage(botToken: SlackBotToken, channel: SlackChannelId, text: string): void {
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${botToken}` },
    payload: JSON.stringify({ channel, text }),
  };
  const res = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
  const body = JSON.parse(res.getContentText()) as { ok: boolean; error?: string };
  if (!body.ok) {
    throw new Error(`slack postMessage failed: ${body.error ?? 'unknown'}`);
  }
}
