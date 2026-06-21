import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../../lib/config';
import { getYesterdayWindow, runGmailDigest, truncateBody } from '.';

const mockResponse = (body: object) => ({
  getContentText: vi.fn().mockReturnValue(JSON.stringify(body)),
});

beforeEach(() => {
  resetConfigCache();
  vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReset().mockReturnValue({
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_CHANNEL_ID: 'C123456',
    GMAIL_DIGEST_LABEL: 'Newsletter',
  });
  vi.mocked(UrlFetchApp.fetch)
    .mockReset()
    .mockReturnValue(mockResponse({ ok: true }) as never);
  vi.mocked(GmailApp.search).mockReset().mockReturnValue([]);
});

describe('getYesterdayWindow', () => {
  it('UTC 2026-01-02T05:00:00ZではJST前日範囲を返す', () => {
    expect(getYesterdayWindow(new Date('2026-01-02T05:00:00Z'))).toEqual({
      after: '2026/01/01',
      before: '2026/01/02',
    });
  });

  it('JST 23:59:59では同じJST日の前日範囲を返す', () => {
    expect(getYesterdayWindow(new Date('2026-01-02T14:59:59Z'))).toEqual({
      after: '2026/01/01',
      before: '2026/01/02',
    });
  });

  it('JST 翌0:00では翌日の前日範囲を返す', () => {
    expect(getYesterdayWindow(new Date('2026-01-02T15:00:00Z'))).toEqual({
      after: '2026/01/02',
      before: '2026/01/03',
    });
  });
});

describe('truncateBody', () => {
  it('200字以下はそのまま返す', () => {
    expect(truncateBody('短い本文')).toBe('短い本文');
  });

  it('200字を超える場合は…を付けてトリムする', () => {
    const long = 'あ'.repeat(201);
    expect(truncateBody(long)).toBe(`${'あ'.repeat(200)}…`);
  });

  it('ホワイトスペースを正規化する', () => {
    expect(truncateBody('hello\n\n  world')).toBe('hello world');
  });

  it('maxLen を指定できる', () => {
    expect(truncateBody('abcde', 3)).toBe('abc…');
  });
});

describe('runGmailDigest', () => {
  it('2件のNewsletterスレッドをSlackに1回投稿する', () => {
    vi.mocked(GmailApp.search).mockReturnValue([
      createThread('Subject 1', 'sender1@example.com', '本文1'),
      createThread('Subject 2', 'sender2@example.com'),
    ]);

    runGmailDigest();

    expect(GmailApp.search).toHaveBeenCalledWith(
      expect.stringMatching(
        /^label:Newsletter after:\d{4}\/\d{2}\/\d{2} before:\d{4}\/\d{2}\/\d{2}$/
      )
    );
    expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    const payload = JSON.parse((options as { payload: string }).payload) as { text: string };
    expect(payload.text).toContain('Subject 1');
    expect(payload.text).toContain('sender1@example.com');
    expect(payload.text).toContain('本文1');
    expect(payload.text).toContain('Subject 2');
    expect(payload.text).toContain('sender2@example.com');
  });

  it('Newsletterスレッドが0件の場合もSlackに該当なしを投稿する', () => {
    vi.mocked(GmailApp.search).mockReturnValue([]);

    runGmailDigest();

    expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    const payload = JSON.parse((options as { payload: string }).payload) as { text: string };
    expect(payload.text).toContain('ありません');
  });
});

function createThread(
  subject: string,
  from: string,
  body = ''
): GoogleAppsScript.Gmail.GmailThread {
  return {
    getMessages: vi.fn().mockReturnValue([
      {
        getSubject: vi.fn().mockReturnValue(subject),
        getFrom: vi.fn().mockReturnValue(from),
        getPlainBody: vi.fn().mockReturnValue(body),
      },
    ]),
  } as unknown as GoogleAppsScript.Gmail.GmailThread;
}
