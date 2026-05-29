export type Config = {
  secretToken: string;
  geminiApiKey: string;
  geminiModel: string;
  notionApiKey: string;
  notionDbId: string;
};

export function getConfig(): Config {
  const props = PropertiesService.getScriptProperties();
  return {
    secretToken: props.getProperty('SECRET_TOKEN') ?? '',
    geminiApiKey: props.getProperty('GEMINI_API_KEY') ?? '',
    geminiModel: props.getProperty('GEMINI_MODEL') ?? 'gemini-2.5-flash',
    notionApiKey: props.getProperty('NOTION_API_KEY') ?? '',
    notionDbId: props.getProperty('NOTION_DB_ID') ?? '',
  };
}
