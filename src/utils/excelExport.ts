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
    'External Link': event.external_link || '',
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
