import * as XLSX from 'xlsx';

export const exportEventsToExcel = (events: any[], filename: string = 'events.xlsx') => {
  // Prepare data for Excel
  const data = events.map(event => ({
    'Title': event.title || '',
    'Description': event.description || '',
    'Date': event.date || '',
    'Time': event.time || '',
    'Location': event.location || '',
    'Address': event.address || '',
    'Price': event.price || '',
    'Price Range': event.price_range || '',
    'Event Type': event.event_type || '',
    'Mood': event.mood || '',
    'Music Type': event.music_type || '',
    'Venue Name': event.venue_name || '',
    'Venue Size': event.venue_size || '',
    'Target Audience': event.target_audience || '',
    'Market': event.market || '',
    'Image URL': event.image_url || '',
    'Video URL': event.video_url || '',
    'Instagram/External Link': event.external_link || '',
    'Ticket Link': event.ticket_link || '',
    'Created At': event.created_at || '',
    'Updated At': event.updated_at || '',
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Events');

  // Generate and download file
  XLSX.writeFile(wb, filename);
};

export const exportTopListsToExcel = (lists: any[], filename: string = 'top-lists.xlsx') => {
  // Prepare data for Excel
  const data = lists.map(list => ({
    'Title': list.title || '',
    'Category': list.category || '',
    'Description': list.description || '',
    'User ID': list.user_id || '',
    'Created At': list.created_at || '',
    'Updated At': list.updated_at || '',
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Top Lists');

  // Generate and download file
  XLSX.writeFile(wb, filename);
};

export const exportTopListItemsToExcel = (items: any[], filename: string = 'top-list-items.xlsx') => {
  // Prepare data for Excel
  const data = items.map(item => ({
    'Name': item.name || '',
    'List Name': item.list_name || '',
    'Category': item.category || '',
    'Description': item.description || '',
    'Location': item.location || '',
    'Display Order': item.display_order || '',
    'List ID': item.list_id || '',
    'Image URL': item.image_url || '',
    'Instagram/URL': item.url || '',
    'Created At': item.created_at || '',
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Top List Items');

  // Generate and download file
  XLSX.writeFile(wb, filename);
};
