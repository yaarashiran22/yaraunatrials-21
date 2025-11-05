import React, { createContext, useContext, useState, useMemo } from 'react';

interface NewItemContextType {
  isOpen: boolean;
  openNewItem: () => void;
  closeNewItem: () => void;
  refreshItems: () => void;
  setRefreshCallback: (callback: () => void) => void;
}

const NewItemContext = createContext<NewItemContextType | undefined>(undefined);

export const useNewItem = () => {
  const context = useContext(NewItemContext);
  if (context === undefined) {
    throw new Error('useNewItem must be used within a NewItemProvider');
  }
  return context;
};

interface NewItemProviderProps {
  children: React.ReactNode;
}

export const NewItemProvider: React.FC<NewItemProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [refreshCallback, setRefreshCallback] = useState<(() => void) | null>(null);

  const value = useMemo(() => ({
    isOpen,
    openNewItem: () => setIsOpen(true),
    closeNewItem: () => setIsOpen(false),
    refreshItems: () => {
      if (refreshCallback) {
        refreshCallback();
      }
    },
    setRefreshCallback: (callback: () => void) => {
      setRefreshCallback(() => callback);
    }
  }), [isOpen, refreshCallback]);

  return (
    <NewItemContext.Provider value={value}>
      {children}
    </NewItemContext.Provider>
  );
};