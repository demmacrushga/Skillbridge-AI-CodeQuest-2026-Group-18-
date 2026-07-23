import AsyncStorage from '@react-native-async-storage/async-storage';
import { Achievement, UserExp } from '@/types/achievements';

const EXP_STORAGE_KEY = '@skillbridge_user_exp';
const ACH_STORAGE_KEY = '@skillbridge_user_ach';

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_1',
    title: 'Roadmap Pioneer',
    description: 'Generated your first AI-powered career roadmap.',
    icon: 'map-outline',
    expReward: 500,
    unlockedAt: new Date().toISOString(),
  },
  {
    id: 'ach_2',
    title: 'Profile Perfection',
    description: 'Completed your profile information and verified your email.',
    icon: 'person-circle-outline',
    expReward: 250,
    unlockedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'ach_3',
    title: 'Skill Collector',
    description: 'Added at least 5 distinct skills to your profile.',
    icon: 'star-outline',
    expReward: 300,
    progress: 60,
  },
  {
    id: 'ach_4',
    title: 'Portfolio Starter',
    description: 'Extracted and saved your first portfolio item using AI.',
    icon: 'briefcase-outline',
    expReward: 400,
  },
  {
    id: 'ach_5',
    title: 'Milestone Crusher',
    description: 'Completed 10 milestones on your career roadmap.',
    icon: 'trophy-outline',
    expReward: 1000,
    progress: 20,
  },
  {
    id: 'ach_6',
    title: 'Early Adopter',
    description: 'Joined SkillBridge during the early beta phase.',
    icon: 'rocket-outline',
    expReward: 1000,
    unlockedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  }
];

const DEFAULT_EXP: UserExp = {
  currentLevel: 1,
  currentExp: 0,
  nextLevelExp: 500,
  totalEarnedExp: 0,
};

function calculateLevel(totalExp: number): UserExp {
  let currentLevel = 1;
  let expForNext = 500;
  let expAccumulated = 0;
  
  while (totalExp >= expAccumulated + expForNext) {
    expAccumulated += expForNext;
    currentLevel++;
    expForNext = currentLevel * 500;
  }
  
  return {
    currentLevel,
    currentExp: totalExp - expAccumulated,
    nextLevelExp: expForNext,
    totalEarnedExp: totalExp,
  };
}

export async function getUserAchievements(accessToken: string, userId: string): Promise<Achievement[]> {
  try {
    const data = await AsyncStorage.getItem(ACH_STORAGE_KEY);
    if (data) return JSON.parse(data);
    await AsyncStorage.setItem(ACH_STORAGE_KEY, JSON.stringify(DEFAULT_ACHIEVEMENTS));
    return DEFAULT_ACHIEVEMENTS;
  } catch {
    return DEFAULT_ACHIEVEMENTS;
  }
}

export async function getUserExp(accessToken: string, userId: string): Promise<UserExp> {
  try {
    const data = await AsyncStorage.getItem(EXP_STORAGE_KEY);
    if (data) return JSON.parse(data);
    await AsyncStorage.setItem(EXP_STORAGE_KEY, JSON.stringify(DEFAULT_EXP));
    return DEFAULT_EXP;
  } catch {
    return DEFAULT_EXP;
  }
}

export async function addExp(userId: string, amount: number): Promise<UserExp> {
  try {
    let currentExpData = await getUserExp('', userId);
    let newTotal = currentExpData.totalEarnedExp + amount;
    
    let newExpData = calculateLevel(newTotal);
    await AsyncStorage.setItem(EXP_STORAGE_KEY, JSON.stringify(newExpData));
    
    return newExpData;
  } catch (e) {
    console.error('Failed to add EXP', e);
    return DEFAULT_EXP;
  }
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<void> {
  try {
    const achs = await getUserAchievements('', userId);
    const updated = achs.map(a => {
        if (a.id === achievementId && !a.unlockedAt) {
            a.unlockedAt = new Date().toISOString();
        }
        return a;
    });
    await AsyncStorage.setItem(ACH_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to unlock achievement', e);
  }
}
