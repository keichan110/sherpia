import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../capabilities/notion');

import {
  appendBlockChildren,
  createPage,
  queryDatabase,
  updatePage,
} from '../../capabilities/notion';
import type { GeminiResult } from './gemini';
import {
  clearPendingArticlesFlag,
  createPendingRecord,
  DuplicateUrlError,
  hasPendingArticles,
  incrementRetryCount,
  queryPendingRecord,
  registerPendingRecord,
  updateRecord,
} from './pending';

const mockGeminiResult: GeminiResult = {
  title: 'テスト記事',
  overview: 'TypeScriptとVitestを使ったテスト手法の紹介記事',
  summary: [
    { heading: '背景', body: '背景の詳細' },
    { heading: '内容', body: '内容の詳細' },
  ],
  category: 'AI/ML',
  tags: ['TypeScript', 'Vitest'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queryDatabase).mockReturnValue({ results: [] });
  vi.mocked(createPage).mockReturnValue('page-123');
});

describe('pending flag', () => {
  it('HAS_PENDINGの状態確認をarticle-ingest側から行う', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperty).mockReturnValue('true');

    expect(hasPendingArticles()).toBe(true);
  });

  it('HAS_PENDINGの削除をarticle-ingest側から行う', () => {
    clearPendingArticlesFlag();

    expect(PropertiesService.getScriptProperties().setProperty).toHaveBeenCalledWith(
      'HAS_PENDING',
      'false'
    );
  });
});

describe('createPendingRecord', () => {
  it('未登録URLの場合は処理待ちレコードを作成してページIDを返す', () => {
    const id = createPendingRecord('https://example.com', 'db-id', 'notion-key');

    expect(id).toBe('page-123');
    expect(createPage).toHaveBeenCalledWith(
      'db-id',
      expect.objectContaining({
        URL: { url: 'https://example.com' },
      }),
      'notion-key'
    );
    const properties = vi.mocked(createPage).mock.calls[0][1];
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['ステータス']).toEqual({ select: { name: '処理待ち' } });
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['リトライ回数']).toEqual({ number: 0 });
  });

  it('URLフィルタをかけた重複チェッククエリを先に送る', () => {
    createPendingRecord('https://example.com', 'db-id', 'notion-key');

    expect(queryDatabase).toHaveBeenCalledWith(
      'db-id',
      {
        filter: {
          property: 'URL',
          url: { equals: 'https://example.com' },
        },
        page_size: 1,
      },
      'notion-key'
    );
  });

  it('登録済みURLの場合はDuplicateUrlErrorを投げてページを作成しない', () => {
    vi.mocked(queryDatabase).mockReturnValue({ results: [{ id: 'existing-page' }] });

    expect(() => createPendingRecord('https://example.com', 'db-id', 'notion-key')).toThrow(
      DuplicateUrlError
    );
    expect(createPage).not.toHaveBeenCalled();
  });
});

describe('registerPendingRecord', () => {
  it('仮登録に成功した場合だけHAS_PENDINGをセットする', () => {
    registerPendingRecord('https://example.com', 'db-id', 'notion-key');

    expect(PropertiesService.getScriptProperties().setProperty).toHaveBeenCalledWith(
      'HAS_PENDING',
      'true'
    );
  });

  it('重複時はHAS_PENDINGをセットしない', () => {
    vi.mocked(queryDatabase).mockReturnValue({ results: [{ id: 'existing-page' }] });

    expect(() => registerPendingRecord('https://example.com', 'db-id', 'notion-key')).toThrow(
      DuplicateUrlError
    );
    expect(PropertiesService.getScriptProperties().setProperty).not.toHaveBeenCalled();
  });
});

describe('queryPendingRecord', () => {
  it('ステータス「処理待ち」でフィルタしたクエリを送る', () => {
    vi.mocked(queryDatabase).mockReturnValue({
      results: [{ id: 'page-1', properties: { URL: { url: 'https://example.com' } } }],
    });

    queryPendingRecord('db-id', 'notion-key');

    expect(queryDatabase).toHaveBeenCalledWith(
      'db-id',
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
      'notion-key'
    );
  });

  it('結果が存在する場合はIDとURLとリトライ回数を返す', () => {
    vi.mocked(queryDatabase).mockReturnValue({
      results: [
        {
          id: 'page-1',
          properties: { URL: { url: 'https://example.com' }, リトライ回数: { number: 3 } },
        },
      ],
    });

    const result = queryPendingRecord('db-id', 'notion-key');

    expect(result).toEqual({ id: 'page-1', url: 'https://example.com', retryCount: 3 });
  });

  it('リトライ回数フィールドがない場合はretryCount=0を返す', () => {
    vi.mocked(queryDatabase).mockReturnValue({
      results: [{ id: 'page-1', properties: { URL: { url: 'https://example.com' } } }],
    });

    const result = queryPendingRecord('db-id', 'notion-key');

    expect(result).toEqual({ id: 'page-1', url: 'https://example.com', retryCount: 0 });
  });

  it('結果が0件の場合はnullを返す', () => {
    vi.mocked(queryDatabase).mockReturnValue({ results: [] });

    const result = queryPendingRecord('db-id', 'notion-key');

    expect(result).toBeNull();
  });
});

describe('incrementRetryCount', () => {
  it('リトライ回数+1をページプロパティとして送る', () => {
    incrementRetryCount('page-1', 2, 'notion-key');

    expect(updatePage).toHaveBeenCalledWith(
      'page-1',
      {
        // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
        ['リトライ回数']: { number: 3 },
      },
      'notion-key'
    );
  });
});

describe('updateRecord', () => {
  it('「完了」時はプロパティ更新とブロック追加を行う', () => {
    updateRecord('page-1', mockGeminiResult, '完了', 'notion-key');

    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(appendBlockChildren).toHaveBeenCalledTimes(1);
  });

  it('「完了」時にGeminiResultのプロパティを書き込む', () => {
    updateRecord('page-1', mockGeminiResult, '完了', 'notion-key');

    const [, properties] = vi.mocked(updatePage).mock.calls[0];
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['タイトル']).toEqual({ title: [{ text: { content: 'テスト記事' } }] });
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['ステータス']).toEqual({ select: { name: '完了' } });
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['タグ']).toEqual({
      multi_select: [{ name: 'TypeScript' }, { name: 'Vitest' }],
    });
  });

  it('「完了」時に概要と要約のブロックを追加する', () => {
    updateRecord('page-1', mockGeminiResult, '完了', 'notion-key');

    const [, children] = vi.mocked(appendBlockChildren).mock.calls[0];
    const overview = children[0] as { paragraph: { rich_text: { text: { content: string } }[] } };
    const heading2 = children[1] as { heading_2: { rich_text: { text: { content: string } }[] } };
    const heading3 = children[2] as { heading_3: { rich_text: { text: { content: string } }[] } };
    expect(overview.paragraph.rich_text[0].text.content).toBe(
      'TypeScriptとVitestを使ったテスト手法の紹介記事'
    );
    expect(heading2.heading_2.rich_text[0].text.content).toBe('要約');
    expect(heading3.heading_3.rich_text[0].text.content).toBe('背景');
  });

  it('section.bodyが2000文字を超える場合は複数のparagraphブロックに分割する', () => {
    const longBody = '。'.repeat(2500);
    const result: GeminiResult = {
      ...mockGeminiResult,
      summary: [{ heading: '長文セクション', body: longBody }],
    };

    updateRecord('page-1', result, '完了', 'notion-key');

    const [, children] = vi.mocked(appendBlockChildren).mock.calls[0];
    const bodyBlocks = children.filter((b) => b.type === 'paragraph');
    expect(bodyBlocks.length).toBeGreaterThan(2);
    const totalLength = bodyBlocks.slice(1).reduce((sum, b) => {
      const block = b as { paragraph: { rich_text: { text: { content: string } }[] } };
      return sum + block.paragraph.rich_text[0].text.content.length;
    }, 0);
    expect(totalLength).toBe(longBody.length);
  });

  it('分割された各ブロックのcontentは2000文字以下である', () => {
    const longBody = '。'.repeat(2500);
    const result: GeminiResult = {
      ...mockGeminiResult,
      summary: [{ heading: '長文セクション', body: longBody }],
    };

    updateRecord('page-1', result, '完了', 'notion-key');

    const [, children] = vi.mocked(appendBlockChildren).mock.calls[0];
    const bodyBlocks = children.filter((b) => b.type === 'paragraph');
    for (const block of bodyBlocks) {
      const paragraph = block as { paragraph: { rich_text: { text: { content: string } }[] } };
      expect(paragraph.paragraph.rich_text[0].text.content.length).toBeLessThanOrEqual(2000);
    }
  });

  it('改行を境界として優先して分割する', () => {
    const longBody = `${'a'.repeat(1990)}\n${'b'.repeat(500)}`;
    const result: GeminiResult = {
      ...mockGeminiResult,
      summary: [{ heading: '長文セクション', body: longBody }],
    };

    updateRecord('page-1', result, '完了', 'notion-key');

    const [, children] = vi.mocked(appendBlockChildren).mock.calls[0];
    const bodyBlocks = children.filter((b) => b.type === 'paragraph');
    const firstSectionBlock = bodyBlocks[1] as {
      paragraph: { rich_text: { text: { content: string } }[] };
    };
    expect(firstSectionBlock.paragraph.rich_text[0].text.content).toBe(`${'a'.repeat(1990)}\n`);
  });

  it('overviewが2000文字を超える場合も複数ブロックへ分割する', () => {
    const longOverview = '。'.repeat(2500);
    const result: GeminiResult = { ...mockGeminiResult, overview: longOverview };

    updateRecord('page-1', result, '完了', 'notion-key');

    const [, children] = vi.mocked(appendBlockChildren).mock.calls[0];
    const headingIndex = children.findIndex((b) => b.type === 'heading_2');
    const overviewBlocks = children.slice(0, headingIndex).filter((b) => b.type === 'paragraph');
    expect(overviewBlocks.length).toBeGreaterThan(1);
    for (const block of overviewBlocks) {
      const paragraph = block as { paragraph: { rich_text: { text: { content: string } }[] } };
      expect(paragraph.paragraph.rich_text[0].text.content.length).toBeLessThanOrEqual(2000);
    }
  });

  it('「エラー」時はステータスのみ更新してブロックは追加しない', () => {
    updateRecord('page-1', null, 'エラー', 'notion-key');

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [, properties] = vi.mocked(updatePage).mock.calls[0];
    // biome-ignore lint/complexity/useLiteralKeys: 日本語キーはブラケット記法を維持
    expect(properties['ステータス']).toEqual({ select: { name: 'エラー' } });
    expect(appendBlockChildren).not.toHaveBeenCalled();
  });
});
