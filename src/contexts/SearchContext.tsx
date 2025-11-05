import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface SearchContextType {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider = ({ children }: SearchProviderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const value = useMemo(() => ({
    isSearchOpen,
    openSearch: () => setIsSearchOpen(true),
    closeSearch: () => setIsSearchOpen(false)
  }), [isSearchOpen]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};