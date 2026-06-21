import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../../lib/config';
import { runLabelCleanup } from '.';

beforeEach(() => {
  resetConfigCache();
  vi.mocked(PropertiesService.getScriptProperties().getProperties).mockReturnValue({
    GMAIL_CLEANUP_LABELS: 'action',
  });
  vi.mocked(GmailApp.search).mockReset().mockReturnValue([]);
  vi.mocked(GmailApp.getUserLabelByName)
    .mockReset()
    .mockReturnValue({} as GoogleAppsScript.Gmail.GmailLabel);
});

describe('runLabelCleanup', () => {
  it('アーカイブ済みスレッドだけラベルを外す', () => {
    const thread = createThread(false);
    vi.mocked(GmailApp.search).mockReturnValue([thread]);

    runLabelCleanup();

    expect(GmailApp.search).toHaveBeenCalledWith('label:action -in:inbox');
    expect(thread.removeLabel).toHaveBeenCalledTimes(1);
  });

  it('受信トレイ内スレッドは防御的にスキップする', () => {
    const archivedThread = createThread(false);
    const inboxThread = createThread(true);
    vi.mocked(GmailApp.search).mockReturnValue([archivedThread, inboxThread]);

    runLabelCleanup();

    expect(archivedThread.removeLabel).toHaveBeenCalledTimes(1);
    expect(inboxThread.removeLabel).not.toHaveBeenCalled();
  });

  it('対象スレッドが0件の場合はラベル削除を呼ばない', () => {
    runLabelCleanup();

    expect(GmailApp.search).toHaveBeenCalledWith('label:action -in:inbox');
    expect(GmailApp.getUserLabelByName).not.toHaveBeenCalled();
  });
});

function createThread(isInInbox: boolean): GoogleAppsScript.Gmail.GmailThread {
  return {
    isInInbox: vi.fn().mockReturnValue(isInInbox),
    removeLabel: vi.fn(),
  } as unknown as GoogleAppsScript.Gmail.GmailThread;
}
