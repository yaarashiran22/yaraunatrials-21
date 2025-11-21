import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, RefreshCw, Clock, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ChatbotError {
  id: string;
  created_at: string;
  function_name: string;
  error_message: string;
  error_stack: string | null;
  user_query: string | null;
  phone_number: string | null;
  context: any;
  resolved: boolean;
  notes: string | null;
}

export default function ChatbotErrorsPage() {
  const [errors, setErrors] = useState<ChatbotError[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");

  const fetchErrors = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("chatbot_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter === "unresolved") {
        query = query.eq("resolved", false);
      } else if (filter === "resolved") {
        query = query.eq("resolved", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setErrors(data || []);
    } catch (error) {
      console.error("Error fetching errors:", error);
      toast.error("Failed to fetch errors");
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (errorId: string) => {
    try {
      const { error } = await supabase
        .from("chatbot_errors")
        .update({ resolved: true })
        .eq("id", errorId);

      if (error) throw error;
      toast.success("Marked as resolved");
      fetchErrors();
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Failed to update error status");
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [filter]);

  const getErrorStats = () => {
    const total = errors.length;
    const resolved = errors.filter((e) => e.resolved).length;
    const unresolved = total - resolved;
    
    const last24h = errors.filter(
      (e) => new Date(e.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return { total, resolved, unresolved, last24h };
  };

  const stats = getErrorStats();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Chatbot Error Monitoring</h1>
        <p className="text-muted-foreground">
          Track and resolve errors from your Yara AI WhatsApp chatbot
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.unresolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24h}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Refresh */}
      <div className="flex justify-between items-center mb-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={fetchErrors} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Errors List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : errors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium">No errors found</p>
            <p className="text-muted-foreground">
              {filter === "unresolved"
                ? "All errors have been resolved!"
                : "Your chatbot is running smoothly"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {errors.map((error) => (
            <Card key={error.id} className={error.resolved ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={error.resolved ? "secondary" : "destructive"}>
                        {error.resolved ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                        {error.resolved ? "Resolved" : "Unresolved"}
                      </Badge>
                      <Badge variant="outline">{error.function_name}</Badge>
                    </div>
                    <CardTitle className="text-lg">{error.error_message}</CardTitle>
                    <CardDescription className="mt-2 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(error.created_at).toLocaleString()}
                      </span>
                      {error.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {error.phone_number}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {!error.resolved && (
                    <Button
                      onClick={() => markAsResolved(error.id)}
                      variant="outline"
                      size="sm"
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {error.user_query && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <MessageSquare className="w-4 h-4" />
                      User Query
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">{error.user_query}</p>
                  </div>
                )}
                
                {error.error_stack && (
                  <details className="mb-3">
                    <summary className="text-sm font-medium cursor-pointer mb-2">
                      Stack Trace
                    </summary>
                    <ScrollArea className="h-[200px] w-full rounded border bg-muted">
                      <pre className="text-xs p-4">{error.error_stack}</pre>
                    </ScrollArea>
                  </details>
                )}

                {error.context && (
                  <details>
                    <summary className="text-sm font-medium cursor-pointer mb-2">
                      Context Data
                    </summary>
                    <ScrollArea className="h-[200px] w-full rounded border bg-muted">
                      <pre className="text-xs p-4">{JSON.stringify(error.context, null, 2)}</pre>
                    </ScrollArea>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
