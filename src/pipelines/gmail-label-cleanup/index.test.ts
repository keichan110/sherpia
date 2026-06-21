import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runLabelCleanup } from '.';

beforeEach(() => {
  vi.mocked(GmailApp.search).mockReset().mockReturnValue([]);
  vi.mocked(GmailApp.getUserLabelByName)
    .mockReset()
    .mockReturnValue({} as GoogleAppsScript.Gmail.GmailLabel);
});

describe('runLabelCleanup', () => {
  it('アーカイブ済みスレッドだけラベルを外す', () => {
    const thread = createThread(false);
    vi.mocked(GmailApp.search)
      .mockReturnValueOnce([thread]) // action
      .mockReturnValueOnce([]); // pending

    runLabelCleanup();

    expect(GmailApp.search).toHaveBeenCalledWith('label:action -in:inbox');
    expect(GmailApp.search).toHaveBeenCalledWith('label:pending -in:inbox');
    expect(thread.removeLabel).toHaveBeenCalledTimes(1);
  });

  it('受信トレイ内スレッドは防御的にスキップする', () => {
    const archivedThread = createThread(false);
    const inboxThread = createThread(true);
    vi.mocked(GmailApp.search)
      .mockReturnValueOnce([archivedThread, inboxThread]) // action
      .mockReturnValueOnce([]); // pending

    runLabelCleanup();

    expect(archivedThread.removeLabel).toHaveBeenCalledTimes(1);
    expect(inboxThread.removeLabel).not.toHaveBeenCalled();
  });

  it('対象スレッドが0件の場合はラベル削除を呼ばない', () => {
    runLabelCleanup();

    expect(GmailApp.search).toHaveBeenCalledWith('label:action -in:inbox');
    expect(GmailApp.search).toHaveBeenCalledWith('label:pending -in:inbox');
    expect(GmailApp.getUserLabelByName).not.toHaveBeenCalled();
  });
});

function createThread(isInInbox: boolean): GoogleAppsScript.Gmail.GmailThread {
  return {
    isInInbox: vi.fn().mockReturnValue(isInInbox),
    removeLabel: vi.fn(),
  } as unknown as GoogleAppsScript.Gmail.GmailThread;
}
