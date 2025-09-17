import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MeetupFiltersPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MeetupFiltersPopup = ({ isOpen, onClose }: MeetupFiltersPopupProps) => {
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [selectedVibe, setSelectedVibe] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Filter Meetups</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-600" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Price Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Price
            </label>
            <Select value={selectedPrice} onValueChange={setSelectedPrice}>
              <SelectTrigger className="w-full bg-white border border-gray-200 text-gray-900">
                <SelectValue placeholder="Select price range" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 z-[70]">
                <SelectItem value="free" className="text-gray-900 hover:bg-gray-100">Free</SelectItem>
                <SelectItem value="paid" className="text-gray-900 hover:bg-gray-100">Paid</SelectItem>
                <SelectItem value="0-20" className="text-gray-900 hover:bg-gray-100">$0-$20</SelectItem>
                <SelectItem value="20-50" className="text-gray-900 hover:bg-gray-100">$20-$50</SelectItem>
                <SelectItem value="50+" className="text-gray-900 hover:bg-gray-100">$50+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Neighborhood Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Neighborhood
            </label>
            <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
              <SelectTrigger className="w-full bg-white border border-gray-200 text-gray-900">
                <SelectValue placeholder="Select neighborhood" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 z-[70]">
                <SelectItem value="all" className="text-gray-900 hover:bg-gray-100">All</SelectItem>
                <SelectItem value="palermo" className="text-gray-900 hover:bg-gray-100">Palermo</SelectItem>
                <SelectItem value="recoleta" className="text-gray-900 hover:bg-gray-100">Recoleta</SelectItem>
                <SelectItem value="san-telmo" className="text-gray-900 hover:bg-gray-100">San Telmo</SelectItem>
                <SelectItem value="puerto-madero" className="text-gray-900 hover:bg-gray-100">Puerto Madero</SelectItem>
                <SelectItem value="belgrano" className="text-gray-900 hover:bg-gray-100">Belgrano</SelectItem>
                <SelectItem value="villa-crespo" className="text-gray-900 hover:bg-gray-100">Villa Crespo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vibe Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Vibe
            </label>
            <Select value={selectedVibe} onValueChange={setSelectedVibe}>
              <SelectTrigger className="w-full bg-white border border-gray-200 text-gray-900">
                <SelectValue placeholder="Select vibe" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 z-[70]">
                <SelectItem value="casual" className="text-gray-900 hover:bg-gray-100">Casual</SelectItem>
                <SelectItem value="professional" className="text-gray-900 hover:bg-gray-100">Professional</SelectItem>
                <SelectItem value="party" className="text-gray-900 hover:bg-gray-100">Party</SelectItem>
                <SelectItem value="cultural" className="text-gray-900 hover:bg-gray-100">Cultural</SelectItem>
                <SelectItem value="sports" className="text-gray-900 hover:bg-gray-100">Sports</SelectItem>
                <SelectItem value="creative" className="text-gray-900 hover:bg-gray-100">Creative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Date
            </label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-full bg-white border border-gray-200 text-gray-900">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 z-[70]">
                <SelectItem value="today" className="text-gray-900 hover:bg-gray-100">Today</SelectItem>
                <SelectItem value="tomorrow" className="text-gray-900 hover:bg-gray-100">Tomorrow</SelectItem>
                <SelectItem value="this-week" className="text-gray-900 hover:bg-gray-100">This week</SelectItem>
                <SelectItem value="next-week" className="text-gray-900 hover:bg-gray-100">Next week</SelectItem>
                <SelectItem value="this-month" className="text-gray-900 hover:bg-gray-100">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
          >
            Clear All
          </Button>
          <Button 
            onClick={onClose}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};