import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WhatsAppQRPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  // Your actual WhatsApp bot number
  const whatsappNumber = "14842865805";
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        whatsappLink,
        {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error) => {
          if (error) console.error(error);
        }
      );
    }
  }, [whatsappLink]);

  const downloadQR = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "yara-whatsapp-qr.png";
      link.href = url;
      link.click();
      toast({
        title: "QR Code Downloaded",
        description: "The QR code has been saved to your device",
      });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(whatsappLink);
    toast({
      title: "Link Copied",
      description: "WhatsApp link copied to clipboard",
    });
  };

  const openWhatsApp = () => {
    window.open(whatsappLink, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Yara AI WhatsApp Bot</CardTitle>
          <CardDescription>
            Scan this QR code or click the button to chat with Yara
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center bg-white p-6 rounded-lg">
            <canvas ref={canvasRef} />
          </div>

          <div className="space-y-2">
            <Button 
              onClick={openWhatsApp} 
              className="w-full" 
              size="lg"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Open WhatsApp
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={downloadQR} 
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Download QR
              </Button>
              
              <Button 
                onClick={copyLink} 
                variant="outline"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p className="font-mono">+1 (484) 286-5805</p>
            <p className="text-xs">{whatsappLink}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppQRPage;
