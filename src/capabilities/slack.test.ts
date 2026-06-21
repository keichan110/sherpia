import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postMessage, type SlackBotToken, type SlackChannelId } from './slack';

const mockResponse = (body: object) => ({
  getContentText: vi.fn().mockReturnValue(JSON.stringify(body)),
});

beforeEach(() => {
  vi.mocked(UrlFetchApp.fetch).mockReset();
});

describe('postMessage', () => {
  it('Slack APIがok:trueの場合はchat.postMessageに認証ヘッダーとpayloadを送る', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(mockResponse({ ok: true }) as never);

    postMessage('xoxb-test' as SlackBotToken, 'C123456' as SlackChannelId, 'hello');

    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer xoxb-test' },
        payload: JSON.stringify({ channel: 'C123456', text: 'hello' }),
      })
    );
  });

  it('Slack APIがok:falseの場合はエラーを投げる', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(
      mockResponse({ ok: false, error: 'channel_not_found' }) as never
    );

    expect(() =>
      postMessage('xoxb-test' as SlackBotToken, 'C123456' as SlackChannelId, 'hello')
    ).toThrow('slack postMessage failed: channel_not_found');
  });
});
