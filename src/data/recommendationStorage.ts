import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recommendation } from '@/domain/recommendation';

const KEY = '@agenda-nicolly/recommendations';

export async function loadRecommendations(): Promise<Recommendation[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Recommendation =>
      item && typeof item.id === 'string' && typeof item.description === 'string' &&
      (item.target === 'agenda-namorada' || item.target === 'Agenda') &&
      typeof item.createdAt === 'string' && typeof item.trackingUrl === 'string');
  } catch {
    return [];
  }
}

export async function saveRecommendations(items: Recommendation[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
}
