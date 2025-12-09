import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CreateActionSelector = () => {
  const navigate = useNavigate();

  return (
    <Button
      size="lg"
      onClick={() => navigate('/create-event')}
      className="rounded-full w-14 h-14 shadow-lg flex flex-col items-center justify-center"
      style={{ backgroundColor: '#BB31E9', color: 'hsl(0 0% 100%)' }}
    >
      <Plus className="h-6 w-6 text-primary-foreground" />
    </Button>
  );
};

export default CreateActionSelector;
