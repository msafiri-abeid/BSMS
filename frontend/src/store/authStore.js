// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],

      setAuth: (user, accessToken, refreshToken) => {
        const permissions = user?.role?.permissions || [];
        set({ user, accessToken, refreshToken, permissions });
      },

      setAccessToken: (accessToken) => set({ accessToken }),

      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, permissions: [] }),

      hasPermission: (module, action) => {
        const { user, permissions } = get();
        if (user?.role?.name === 'Admin') return true;
        return permissions.some(p => p.module === module && p.action === action);
      },

      getRoleName: () => get().user?.role?.name || '',

      updateAuthUser: (userData) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...userData } });
      },
    }),
    {
      name: 'bentabet-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        permissions: state.permissions,
      }),
    }
  )
);
