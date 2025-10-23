export const getRelativeDay = (dateString?: string | null): string => {
  if (!dateString) return 'Date TBD';
  
  // Check if it's a recurring event (e.g., "every monday", "Every Tuesday")
  const lowerDateString = dateString.toLowerCase().trim();
  if (lowerDateString.startsWith('every ')) {
    // Capitalize first letter of each word for display
    return dateString
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  const targetDate = new Date(dateString);
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const targetDay = targetDate.getDay();
  
  // Calculate days until the target date
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // If it's more than 7 days away, show the actual date
  if (diffDays > 7 || diffDays < 0) {
    return targetDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // If it's today
  if (diffDays === 0) {
    return 'Today';
  }
  
  // If it's tomorrow
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  
  // If it's this week
  if (diffDays <= 7) {
    return `This ${dayNames[targetDay]}`;
  }
  
  return targetDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};