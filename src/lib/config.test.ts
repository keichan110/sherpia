import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getConfig,
  getGeminiConfig,
  getGmailCleanupConfig,
  getNotionConfig,
  getSecretConfig,
  resetConfigCache,
} from './config';

describe('getConfig', () => {
  beforeEach(() => {
    resetConfigCache();
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReset();
  });

  it('スクリプトプロパティを一括取得して返す', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
      SECRET_TOKEN: 'token123',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-2.0-flash',
      NOTION_ACCESS_TOKEN: 'notion-key',
      NOTION_DB_ID: 'db-id',
      GMAIL_CLEANUP_LABELS: 'action, pending,review',
    });

    const config = getConfig();

    expect(config).toEqual({
      secretToken: 'token123',
      geminiApiKey: 'gemini-key',
      geminiModel: 'gemini-2.0-flash',
      notionAccessToken: 'notion-key',
      notionDbId: 'db-id',
      gmailCleanupLabels: ['action', 'pending', 'review'],
    });
    expect(PropertiesService.getScriptProperties().getProperties).toHaveBeenCalledTimes(1);
  });

  it('複数回呼び出しても PropertiesService.getProperties は1回しか呼ばない', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
      SECRET_TOKEN: 'token123',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-2.0-flash',
      NOTION_ACCESS_TOKEN: 'notion-key',
      NOTION_DB_ID: 'db-id',
      GMAIL_CLEANUP_LABELS: 'action,pending',
    });

    getConfig();
    getConfig();
    getSecretConfig();
    getGeminiConfig();
    getNotionConfig();
    getGmailCleanupConfig();

    expect(PropertiesService.getScriptProperties().getProperties).toHaveBeenCalledTimes(1);
  });

  it('プロパティがない場合はデフォルト値を使う', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({});

    const config = getConfig();

    expect(config).toEqual({
      secretToken: '',
      geminiApiKey: '',
      geminiModel: 'gemini-3.1-flash-lite',
      notionAccessToken: '',
      notionDbId: '',
      gmailCleanupLabels: ['action', 'pending'],
    });
  });

  it('GMAIL_CLEANUP_LABELS がある場合はカンマ区切りを配列で返す', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
      GMAIL_CLEANUP_LABELS: 'action, pending, review',
    });

    const config = getConfig();

    expect(config.gmailCleanupLabels).toEqual(['action', 'pending', 'review']);
  });

  it('GMAIL_CLEANUP_LABELS がない場合はデフォルトラベルを返す', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({});

    const config = getConfig();

    expect(config.gmailCleanupLabels).toEqual(['action', 'pending']);
  });

  it('スコープ別ゲッターはキャッシュ済みスナップショットのスライスを返す', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
      SECRET_TOKEN: 'token123',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-2.0-flash',
      NOTION_ACCESS_TOKEN: 'notion-key',
      NOTION_DB_ID: 'db-id',
      GMAIL_CLEANUP_LABELS: 'action,archive',
    });

    expect(getSecretConfig()).toEqual({
      secretToken: 'token123',
    });
    expect(getGeminiConfig()).toEqual({
      geminiApiKey: 'gemini-key',
      geminiModel: 'gemini-2.0-flash',
    });
    expect(getNotionConfig()).toEqual({
      notionAccessToken: 'notion-key',
      notionDbId: 'db-id',
    });
    expect(getGmailCleanupConfig()).toEqual({
      gmailCleanupLabels: ['action', 'archive'],
    });
    expect(PropertiesService.getScriptProperties().getProperties).toHaveBeenCalledTimes(1);
  });

  it('getGmailCleanupConfig はGmailラベル整理設定だけを返す', () => {
    vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
      SECRET_TOKEN: 'token123',
      GMAIL_CLEANUP_LABELS: 'action,pending',
    });

    expect(getGmailCleanupConfig()).toEqual({
      gmailCleanupLabels: ['action', 'pending'],
    });
  });
});
