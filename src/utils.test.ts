import { describe, expect, it } from 'vitest';
import { createResponse } from './utils';

describe('createResponse', () => {
  it('successとmessageをJSON文字列にしてTextOutputを返す', () => {
    const result = createResponse(true, 'OK');

    expect(ContentService.createTextOutput).toHaveBeenCalledWith(
      JSON.stringify({ success: true, message: 'OK' })
    );
    expect(result.setMimeType).toHaveBeenCalledWith(ContentService.MimeType.JSON);
  });

  it('failure時もJSON文字列として渡す', () => {
    createResponse(false, 'error occurred');

    expect(ContentService.createTextOutput).toHaveBeenCalledWith(
      JSON.stringify({ success: false, message: 'error occurred' })
    );
  });
});
