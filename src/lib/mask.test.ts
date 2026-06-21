import { describe, expect, it } from 'vitest';
import { maskPii } from './mask';

describe('maskPii', () => {
  it('http/https のURLをパスとクエリごとリンクに置換する', () => {
    expect(
      maskPii(
        '詳細は https://example.com/users/token-123?email=user@example.com&id=abc と http://example.net/a/b?x=1 を確認'
      )
    ).toBe('詳細は [リンク] と [リンク] を確認');
  });

  it('括弧内のURLは閉じ括弧を残して置換する', () => {
    expect(maskPii('(https://example.com/a) を確認')).toBe('([リンク]) を確認');
  });

  it('URL直後の日本語本文は置換しない', () => {
    expect(maskPii('https://example.com/path?token=abcを確認してください')).toBe(
      '[リンク]を確認してください'
    );
  });

  it('メールアドレスを置換する', () => {
    expect(maskPii('連絡先は user.name+tag@example.co.jp です')).toBe(
      '連絡先は [メールアドレス] です'
    );
  });

  it('ラベル付き番号の値だけをIDに置換する', () => {
    expect(maskPii('会員番号: 12345\nお客様番号　98765\n購読者ID: abc-123\n会員ID xyz_789')).toBe(
      '会員番号: [ID]\nお客様番号　[ID]\n購読者ID: [ID]\n会員ID [ID]'
    );
  });

  it('助詞区切りのIDを置換する', () => {
    expect(maskPii('会員番号は12345です\n会員番号が98765')).toBe(
      '会員番号は[ID]です\n会員番号が[ID]'
    );
  });

  it('全角数字のIDを置換する', () => {
    expect(maskPii('会員番号：１２３４５')).toBe('会員番号：[ID]');
  });

  it('追加ラベル付きの値をIDに置換する', () => {
    expect(maskPii('受付番号: A-123\n予約番号 R987\n注文番号はORD-456\n認証コード：999999')).toBe(
      '受付番号: [ID]\n予約番号 [ID]\n注文番号は[ID]\n認証コード：[ID]'
    );
  });

  it('値が続かないラベルは置換しない', () => {
    expect(maskPii('会員IDはこちら')).toBe('会員IDはこちら');
  });

  it('日本の電話番号を置換する', () => {
    expect(
      maskPii('携帯 090-1234-5678 / 09012345678、固定 03-1234-5678、フリーダイヤル 0120-123-456')
    ).toBe('携帯 [電話番号] / [電話番号]、固定 [電話番号]、フリーダイヤル [電話番号]');
  });

  it('ラベルの無い日付・金額・時刻・番地は置換しない', () => {
    const text =
      'ISO日付は2026-06-30、スラッシュ日付は2026/06/30、漢字日付は6月30日。開始は19:30、金額は1,000円、住所は東京都港区1-2-3。';

    expect(maskPii(text)).toBe(text);
  });

  it('マスク対象が無いテキストはそのまま返す', () => {
    expect(maskPii('セミナー申込期限は2026/06/30までです')).toBe(
      'セミナー申込期限は2026/06/30までです'
    );
  });
});
