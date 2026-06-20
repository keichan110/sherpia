import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendBlockChildren, createPage, queryDatabase, updatePage } from './notion';

const mockResponse = (code: number, text = '') => ({
  getResponseCode: vi.fn().mockReturnValue(code),
  getContentText: vi.fn().mockReturnValue(text),
});

beforeEach(() => {
  vi.mocked(UrlFetchApp.fetch).mockReset();
});

describe('createPage', () => {
  it('POST /v1/pages に親データベースとプロパティを送る', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(
      mockResponse(200, JSON.stringify({ id: 'page-123' })) as never
    );

    const id = createPage('db-id', { URL: { url: 'https://example.com' } }, 'notion-key');

    expect(id).toBe('page-123');
    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages',
      expect.objectContaining({ method: 'post' })
    );
    const [, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    const payload = JSON.parse((options as { payload: string }).payload);
    expect(payload.parent.database_id).toBe('db-id');
    expect(payload.properties.URL.url).toBe('https://example.com');
  });

  it('Notion API共通ヘッダーを付ける', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(
      mockResponse(200, JSON.stringify({ id: 'page-123' })) as never
    );

    createPage('db-id', {}, 'notion-key');

    const [, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    expect(options).toEqual(
      expect.objectContaining({
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer notion-key',
          'Notion-Version': '2022-06-28',
        },
        muteHttpExceptions: true,
      })
    );
  });

  it('200以外のレスポンスの場合はエラーを投げる', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(mockResponse(400, 'Bad Request') as never);

    expect(() => createPage('db-id', {}, 'notion-key')).toThrow('Notion API error');
  });
});

describe('queryDatabase', () => {
  it('POST /v1/databases/{id}/query に指定クエリを送って結果を返す', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(
      mockResponse(200, JSON.stringify({ results: [{ id: 'page-1' }] })) as never
    );

    const result = queryDatabase<{ results: { id: string }[] }>(
      'db-id',
      { page_size: 1 },
      'notion-key'
    );

    expect(result).toEqual({ results: [{ id: 'page-1' }] });
    const [url, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/databases/db-id/query');
    const payload = JSON.parse((options as { payload: string }).payload);
    expect(payload.page_size).toBe(1);
  });
});

describe('updatePage', () => {
  it('PATCH /v1/pages/{id} にプロパティを送る', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(mockResponse(200, '{}') as never);

    updatePage('page-1', { タイトル: { title: [] } }, 'notion-key');

    const [url, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/pages/page-1');
    expect(options).toEqual(expect.objectContaining({ method: 'patch' }));
    const payload = JSON.parse((options as { payload: string }).payload);
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(payload.properties['タイトル'].title).toEqual([]);
  });
});

describe('appendBlockChildren', () => {
  it('PATCH /v1/blocks/{id}/children にchildrenを送る', () => {
    vi.mocked(UrlFetchApp.fetch).mockReturnValue(mockResponse(200, '{}') as never);

    appendBlockChildren(
      'page-1',
      [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } }],
      'notion-key'
    );

    const [url, options] = vi.mocked(UrlFetchApp.fetch).mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/blocks/page-1/children');
    expect(options).toEqual(expect.objectContaining({ method: 'patch' }));
    const payload = JSON.parse((options as { payload: string }).payload);
    expect(payload.children[0].type).toBe('paragraph');
  });
});
