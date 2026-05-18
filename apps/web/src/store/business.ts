import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Business } from '@ai-biz-os/shared';

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
