import * as SecureStore from 'expo-secure-store';

const SERVER_URL_KEY = 'pio_server_url';
const DEFAULT_URL = 'https://plant-share-001.plantio.net';

export async function getServerUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(SERVER_URL_KEY);
  return stored || DEFAULT_URL;
}

export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
}

export function getMqttWsPath(serverUrl: string): string {
  const wsProto = serverUrl.startsWith('https') ? 'wss' : 'ws';
  const host = serverUrl.replace(/^https?:\/\//, '');
  return `${wsProto}://${host}/mqtt`;
}
