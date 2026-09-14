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

      hasPermission: (module, action, submodule) => {
        const { user, permissions } = get();
        if (user?.role?.name === 'Admin') return true;
        return permissions.some(p =>
          p.module === module &&
          p.action === action &&
          (p.submodule == null || submodule == null || p.submodule === submodule)
        );
      },

      getRoleName: () => get().user?.role?.name || '',

      updateAuthUser: (userData) => {
        const current = get().user;
        if (!current) return;
        const nextUser = { ...current, ...userData };
        const nextPermissions = nextUser?.role?.permissions || get().permissions;
        set({ user: nextUser, permissions: nextPermissions });
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
