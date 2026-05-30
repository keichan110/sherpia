export type Config = {
  secretToken: string;
  geminiApiKey: string;
  geminiModel: string;
  notionApiKey: string;
  notionDbId: string;
};

export function getConfig(): Config {
  const scriptProperties = PropertiesService.getScriptProperties();
  return {
    secretToken: scriptProperties.getProperty('SECRET_TOKEN') ?? '',
    geminiApiKey: scriptProperties.getProperty('GEMINI_API_KEY') ?? '',
    geminiModel: scriptProperties.getProperty('GEMINI_MODEL') ?? 'gemini-2.5-flash',
    notionApiKey: scriptProperties.getProperty('NOTION_API_KEY') ?? '',
    notionDbId: scriptProperties.getProperty('NOTION_DB_ID') ?? '',
  };
}
