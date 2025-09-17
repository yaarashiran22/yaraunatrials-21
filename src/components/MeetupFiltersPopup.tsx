import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X, Search } from 'lucide-react';

interface MeetupFiltersPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltersApply?: (filters: MeetupFilters) => void;
  currentFilters?: MeetupFilters;
}

export interface MeetupFilters {
  search: string;
  neighborhood: string;
  priceRange: string;
  mood: string;
  dateRange: string;
}

const neighborhoods = [
  "All Neighborhoods",
  "Palermo",
  "Palermo Soho", 
  "Palermo Hollywood",
  "Palermo Chico",
  "Recoleta",
  "San Telmo",
  "Villa Crespo",
  "Caballito"
] as const;

const priceOptions = [
  "All Prices",
  "Free", 
  "Up to ₪50",
  "₪50-100",
  "₪100-200",
  "Over ₪200"
] as const;

const moodOptions = [
  "All",
  "Chill", 
  "Go Out",
  "Romantic",
  "Active",
  "Creative",
  "Wellness",
  "Music"
] as const;

const dateOptions = [
  "All",
  "Today",
  "Tomorrow", 
  "This Week",
  "This Month"
] as const;

const MeetupFiltersPopup = ({ isOpen, onClose, onFiltersApply, currentFilters }: MeetupFiltersPopupProps) => {
  const defaultFilters: MeetupFilters = {
    search: "",
    neighborhood: "All Neighborhoods",
    priceRange: "All Prices",
    mood: "All",
    dateRange: "All"
  };

  const [filters, setFilters] = useState<MeetupFilters>(currentFilters || defaultFilters);

  const handleApplyFilters = () => {
    onFiltersApply?.(filters);
    onClose();
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    onFiltersApply?.(defaultFilters);
    onClose();
  };

  const hasActiveFilters = filters.search !== "" || 
    filters.neighborhood !== "All Neighborhoods" || 
    filters.priceRange !== "All Prices" || 
    filters.mood !== "All" || 
    filters.dateRange !== "All";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary/10 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Filter Meetups</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-primary/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filter Content */}
        <div className="p-6 space-y-6 bg-white">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary/60 h-4 w-4" />
              <Input
                placeholder="Search meetups..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 rounded-xl border-primary/20 bg-white text-gray-900 focus:border-primary/40"
              />
            </div>
          </div>

          {/* Neighborhood */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Neighborhood</label>
            <Select 
              value={filters.neighborhood} 
              onValueChange={(value) => setFilters({ ...filters, neighborhood: value })}
            >
              <SelectTrigger className="rounded-xl border-primary/20 bg-white text-gray-900 hover:border-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/20 bg-white z-[60]">
                {neighborhoods.map((neighborhood) => (
                  <SelectItem key={neighborhood} value={neighborhood} className="rounded-lg text-gray-900 hover:bg-gray-100">
                    {neighborhood}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Price Range</label>
            <Select 
              value={filters.priceRange} 
              onValueChange={(value) => setFilters({ ...filters, priceRange: value })}
            >
              <SelectTrigger className="rounded-xl border-primary/20 bg-white text-gray-900 hover:border-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/20 bg-white z-[60]">
                {priceOptions.map((option) => (
                  <SelectItem key={option} value={option} className="rounded-lg text-gray-900 hover:bg-gray-100">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Vibe</label>
            <Select 
              value={filters.mood} 
              onValueChange={(value) => setFilters({ ...filters, mood: value })}
            >
              <SelectTrigger className="rounded-xl border-primary/20 bg-white text-gray-900 hover:border-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/20 bg-white z-[60]">
                {moodOptions.map((option) => (
                  <SelectItem key={option} value={option} className="rounded-lg text-gray-900 hover:bg-gray-100">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Date of Meetup</label>
            <Select 
              value={filters.dateRange} 
              onValueChange={(value) => setFilters({ ...filters, dateRange: value })}
            >
              <SelectTrigger className="rounded-xl border-primary/20 bg-white text-gray-900 hover:border-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/20 bg-white z-[60]">
                {dateOptions.map((option) => (
                  <SelectItem key={option} value={option} className="rounded-lg text-gray-900 hover:bg-gray-100">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-primary/10 bg-white">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 rounded-xl border-primary/30 hover:bg-primary/10"
            >
              Clear All
            </Button>
          )}
          <Button
            onClick={handleApplyFilters}
            className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MeetupFiltersPopup;