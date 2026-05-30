export function createResponse(
  success: boolean,
  message: string
): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify({ success, message })).setMimeType(
    ContentService.MimeType.JSON
  );
}
