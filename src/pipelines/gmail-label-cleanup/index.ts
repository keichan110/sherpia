import { removeLabelFromThread, searchThreads } from '../../capabilities/gmail';
import { log } from '../../lib/log';

const CLEANUP_LABELS = ['action', 'pending'] as const;

/**
 * アーカイブ済みメールから運用ラベルを外す。
 * 失敗時は例外を投げ、GAS実行を「失敗」にして異常を検知できるようにする。
 */
export function runLabelCleanup(): void {
  log.info('gmail-label-cleanup', 'start', { labels: CLEANUP_LABELS });

  let removed = 0;
  try {
    for (const labelName of CLEANUP_LABELS) {
      const query = `label:${labelName} -in:inbox`;
      const threads = searchThreads(query);

      for (const thread of threads) {
        if (thread.isInInbox()) continue; // defensive: 受信トレイ内は対象外
        removeLabelFromThread(thread, labelName);
        removed++;
      }
    }
  } catch (err) {
    log.error('gmail-label-cleanup', 'failed', err);
    throw err;
  }

  log.info('gmail-label-cleanup', 'done', { removed });
}
