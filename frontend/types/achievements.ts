import { Ionicons } from '@expo/vector-icons';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  expReward: number;
  unlockedAt?: string; // ISO date string if unlocked
  progress?: number;   // 0 to 100 for in-progress achievements
}

export interface UserExp {
  currentLevel: number;
  currentExp: number;
  nextLevelExp: number;
  totalEarnedExp: number;
}
