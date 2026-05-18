import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Business {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  description: string | null;
  goals: string[];
  timezone: string;
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  tiktok_url?: string | null;
  created_at: string;
}

interface BusinessStore {
  businesses: Business[];
  activeBusiness: Business | null;
  setBusinesses: (businesses: Business[]) => void;
  setActiveBusiness: (business: Business) => void;
}

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set) => ({
      businesses: [],
      activeBusiness: null,
      setBusinesses: (businesses) =>
        set((s) => ({
          businesses,
          activeBusiness: s.activeBusiness ?? businesses[0] ?? null,
        })),
      setActiveBusiness: (business) => set({ activeBusiness: business }),
    }),
    { name: 'ai-biz-os-business' },
  ),
);
