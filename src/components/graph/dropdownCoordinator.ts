'use client';

type DropdownListener = (activeId: string | null) => void;

let currentActiveOrgId: string | null = null;
const listeners = new Set<DropdownListener>();

export const dropdownCoordinator = {
  getActiveId: (): string | null => currentActiveOrgId,

  setActiveId: (orgId: string | null) => {
    currentActiveOrgId = orgId;
    listeners.forEach((listener) => {
      try {
        listener(currentActiveOrgId);
      } catch (err) {
        console.error('Dropdown listener error:', err);
      }
    });
  },

  toggle: (orgId: string): boolean => {
    const next = currentActiveOrgId === orgId ? null : orgId;
    dropdownCoordinator.setActiveId(next);
    return next === orgId;
  },

  close: () => {
    if (currentActiveOrgId !== null) {
      dropdownCoordinator.setActiveId(null);
    }
  },

  subscribe: (listener: DropdownListener) => {
    listeners.add(listener);
    // Immediately invoke with current state upon subscription
    listener(currentActiveOrgId);
    return () => {
      listeners.delete(listener);
    };
  },
};
