import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  SimplifiedModal, 
  SimplifiedModalContent, 
  SimplifiedModalHeader, 
  SimplifiedModalTitle, 
  SimplifiedModalBody 
} from "@/components/ui/simplified-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const FilterPopup = ({ isOpen, onClose }: FilterPopupProps) => {
  const { toast } = useToast();
  const [priceRange, setPriceRange] = useState([50, 500]);
  const [distance, setDistance] = useState([2]);
  const [categories, setCategories] = useState({
    women: false,
    men: false,
    vintage: false,
    home: false,
    clothing: false,
    sports: false
  });

  const handleCategoryChange = (category: string, checked: boolean) => {
    setCategories(prev => ({
      ...prev,
      [category]: checked
    }));
  };

  const handleSave = () => {
    toast({
      title: "הפילטר נשמר!",
      description: "התוצאות עודכנו בהתאם להעדפותיך",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <SimplifiedModal open={isOpen} onOpenChange={onClose}>
      <SimplifiedModalContent className="max-w-sm bg-white">
        <SimplifiedModalHeader className="bg-white">
          <SimplifiedModalTitle className="text-center">
            <div>
              <span className="text-3xl font-bold text-primary">una</span>
              <div className="text-sm text-foreground mt-1">פילטר</div>
            </div>
          </SimplifiedModalTitle>
        </SimplifiedModalHeader>

        <SimplifiedModalBody className="space-y-content-spacious bg-white">
          {/* Price Range */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">טווח מחירים</h3>
            <div className="px-4">
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={1000}
                min={0}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-base text-foreground mt-3">
                <span>₪{priceRange[0]}</span>
                <span>₪{priceRange[1]}</span>
              </div>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">מרחק</h3>
            <div className="px-4">
              <Slider
                value={distance}
                onValueChange={setDistance}
                max={10}
                min={0}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-base text-foreground mt-3">
                <span>0 ק"מ</span>
                <span>{distance[0]} ק"מ</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="women"
                  checked={categories.women}
                  onCheckedChange={(checked) => handleCategoryChange('women', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="women" className="text-base font-medium text-foreground cursor-pointer">
                  נשים
                </label>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="men"
                  checked={categories.men}
                  onCheckedChange={(checked) => handleCategoryChange('men', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="men" className="text-base font-medium text-foreground cursor-pointer">
                  גברים
                </label>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="vintage"
                  checked={categories.vintage}
                  onCheckedChange={(checked) => handleCategoryChange('vintage', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="vintage" className="text-base font-medium text-foreground cursor-pointer">
                  וינטג׳
                </label>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="sports"
                  checked={categories.sports}
                  onCheckedChange={(checked) => handleCategoryChange('sports', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="sports" className="text-base font-medium text-foreground cursor-pointer">
                  ספורט
                </label>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="clothing"
                  checked={categories.clothing}
                  onCheckedChange={(checked) => handleCategoryChange('clothing', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="clothing" className="text-base font-medium text-foreground cursor-pointer">
                  לבוש
                </label>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                <Checkbox 
                  id="home"
                  checked={categories.home}
                  onCheckedChange={(checked) => handleCategoryChange('home', checked as boolean)}
                  className="h-5 w-5"
                />
                <label htmlFor="home" className="text-base font-medium text-foreground cursor-pointer">
                  בית
                </label>
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <div className="pt-content-normal">
            <Button 
              onClick={handleSave}
              size="lg"
              className="w-full btn-3d"
            >
              החל
            </Button>
          </div>
        </SimplifiedModalBody>
      </SimplifiedModalContent>
    </SimplifiedModal>
  );
};

export default FilterPopup;