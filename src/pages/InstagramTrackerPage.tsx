import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Play, Clock, Calendar, MapPin, ExternalLink } from "lucide-react";
import Header from "@/components/Header";

export default function InstagramTrackerPage() {
  const [newHandle, setNewHandle] = useState("");
  const [newName, setNewName] = useState("");
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trackedPages, isLoading } = useQuery({
    queryKey: ['tracked-instagram-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracked_instagram_pages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: recentEvents, refetch: refetchRecentEvents } = useQuery({
    queryKey: ['recent-scanned-events'],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('created_at', oneHourAgo)
        .like('external_link', '%instagram.com%')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const addPageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tracked_instagram_pages')
        .insert({
          instagram_handle: newHandle.replace('@', ''),
          page_name: newName,
          is_active: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-instagram-pages'] });
      setNewHandle("");
      setNewName("");
      toast({
        title: "Success",
        description: "Instagram page added to tracker",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tracked_instagram_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-instagram-pages'] });
      toast({
        title: "Success",
        description: "Instagram page removed from tracker",
      });
    },
  });

  const triggerScanMutation = useMutation({
    mutationFn: async () => {
      setScanning(true);
      const { data, error } = await supabase.functions.invoke('scan-instagram-events');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setScanning(false);
      toast({
        title: "Scan Complete!",
        description: `Scanned ${data.pagesScanned} pages, added ${data.eventsAdded} new events`,
      });
      queryClient.invalidateQueries({ queryKey: ['tracked-instagram-pages'] });
      refetchRecentEvents(); // Refresh the recently added events
    },
    onError: (error: any) => {
      setScanning(false);
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] to-[#2A1F3C]">
      <Header />
      
      <div className="container mx-auto px-4 py-8 mt-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Instagram Event Scanner</h1>
              <p className="text-gray-400">Automatically scan Instagram pages for events</p>
            </div>
            <Button
              onClick={() => triggerScanMutation.mutate()}
              disabled={scanning}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {scanning ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Scan Now
                </>
              )}
            </Button>
          </div>

          <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Add Instagram Page</h2>
            <div className="flex gap-3">
              <Input
                placeholder="Instagram handle (e.g., crobarclub)"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Page name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              <Button
                onClick={() => addPageMutation.mutate()}
                disabled={!newHandle || addPageMutation.isPending}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">Tracked Pages ({trackedPages?.length || 0})</h2>
            
            {isLoading ? (
              <div className="text-gray-400">Loading...</div>
            ) : trackedPages?.length === 0 ? (
              <Card className="p-8 bg-white/5 backdrop-blur-sm border-white/10 text-center">
                <p className="text-gray-400">No Instagram pages tracked yet. Add one above!</p>
              </Card>
            ) : (
              trackedPages?.map((page) => (
                <Card key={page.id} className="p-4 bg-white/5 backdrop-blur-sm border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://instagram.com/${page.instagram_handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-medium text-white hover:text-purple-400"
                          >
                            @{page.instagram_handle}
                          </a>
                          {page.is_active && (
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                              Active
                            </Badge>
                          )}
                        </div>
                        {page.page_name && (
                          <p className="text-sm text-gray-400">{page.page_name}</p>
                        )}
                        {page.last_scanned_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last scanned: {new Date(page.last_scanned_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePageMutation.mutate(page.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card className="p-4 bg-blue-500/10 backdrop-blur-sm border-blue-500/20">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Automatic Daily Scans</h3>
                <p className="text-sm text-gray-400 mt-1">
                  All tracked pages are automatically scanned every day at 3 AM UTC. 
                  The scanner extracts event information and adds new events to your database.
                </p>
              </div>
            </div>
          </Card>

          {recentEvents && recentEvents.length > 0 && (
            <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">
                Recently Added Events ({recentEvents.length})
              </h2>
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <Card key={event.id} className="p-4 bg-white/5 backdrop-blur-sm border-white/10">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-white">{event.title}</h3>
                        {event.external_link && (
                          <a
                            href={event.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-gray-300 line-clamp-2">{event.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                        {event.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {event.date}
                          </div>
                        )}
                        {event.venue_name && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue_name}
                          </div>
                        )}
                        {event.music_type && (
                          <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                            {event.music_type}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500">
                        Added: {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
