import { MapPin, ChevronDown } from "lucide-react";
import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NeighborhoodSelectorProps {
  onNeighborhoodChange?: (neighborhood: string) => void;
}

const neighborhoods = [
  "Palermo",
  "Palermo Chico", 
  "Palermo Hollywood",
  "Palermo Soho",
  "Recoleta",
  "Villa Crespo"
];

const NeighborhoodSelector = ({ onNeighborhoodChange }: NeighborhoodSelectorProps) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("Palermo");

  const handleNeighborhoodSelect = useCallback((neighborhood: string) => {
    setSelectedNeighborhood(neighborhood);
    onNeighborhoodChange?.(neighborhood);
  }, [onNeighborhoodChange]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full border border-red-500 hover:bg-red-600 transition-colors">
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedNeighborhood}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-white border border-border z-50">
        {neighborhoods.map((neighborhood) => (
          <DropdownMenuItem
            key={neighborhood}
            onClick={() => handleNeighborhoodSelect(neighborhood)}
            className={`cursor-pointer ${
              selectedNeighborhood === neighborhood ? 'bg-red-100 text-red-800' : ''
            }`}
          >
            {neighborhood}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NeighborhoodSelector;