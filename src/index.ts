import { getConfig } from './config';
import { callGeminiAPI } from './gemini';
import { fetchArticleContent } from './jina';
import { writeToNotion } from './notion';
import { createResponse } from './utils';

declare const global: {
  doPost: (e: GoogleAppsScript.Events.DoPost) => GoogleAppsScript.Content.TextOutput;
  testRun: () => void;
};

global.doPost = (e) => {
  const config = getConfig();

  let body: { token?: string; url?: string };
  try {
    body = JSON.parse(e.postData.contents) as { token?: string; url?: string };
  } catch {
    return createResponse(false, 'Invalid JSON');
  }

  if (body.token !== config.secretToken) {
    return createResponse(false, 'Unauthorized');
  }

  const url = body.url;
  if (!url) {
    return createResponse(false, 'URL is required');
  }

  const articleText = fetchArticleContent(url);
  if (!articleText) {
    return createResponse(false, 'Failed to fetch article');
  }

  let geminiResult;
  try {
    geminiResult = callGeminiAPI(articleText, config);
  } catch {
    return createResponse(false, 'Failed to summarize');
  }

  try {
    writeToNotion(geminiResult, url, config);
  } catch (err) {
    return createResponse(false, `Notion write failed: ${String(err)}`);
  }

  return createResponse(true, 'Success');
};

global.testRun = () => {
  const config = getConfig();
  const testUrl = 'https://zenn.dev/';

  const articleText = fetchArticleContent(testUrl);
  Logger.log(`Fetched: ${articleText.substring(0, 200)}`);

  const result = callGeminiAPI(articleText, config);
  Logger.log(JSON.stringify(result));

  writeToNotion(result, testUrl, config);
  Logger.log('Done');
};
