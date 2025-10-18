import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Download, Share, Clock, CheckCircle } from "lucide-react";
import { UserCoupon } from "@/hooks/useUserCoupons";
import { CouponClaim } from "@/hooks/useCouponClaims";

interface CouponQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoupon?: UserCoupon | null;
  claim?: CouponClaim | null;
  qrCodeData?: string;
}

export const CouponQRModal = ({ isOpen, onClose, userCoupon, claim, qrCodeData }: CouponQRModalProps) => {
  const item = userCoupon;
  const displayQRCode = claim?.qr_code_data || qrCodeData;
  
  if (!item || !displayQRCode) return null;

  const handleDownload = () => {
    if (displayQRCode) {
      const link = document.createElement('a');
      link.href = displayQRCode;
      link.download = `coupon-${item.business_name || item.title}-${item.title}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Coupon: ${item.title}`,
          text: `Check out this coupon from ${item.business_name || item.title}!`,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md mx-auto bg-background border border-border/50 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-3">
          <DialogTitle className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <QrCode className="w-6 h-6 text-primary" />
            Your Coupon
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2 pb-4">
          {/* Business Info */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{item.business_name || item.title}</h3>
            <p className="text-base font-medium text-primary">{item.title}</p>
            {item.discount_amount && (
              <div className="bg-primary/10 rounded-lg p-2 inline-block">
                <span className="text-primary font-bold text-lg">{item.discount_amount}</span>
              </div>
            )}
          </div>

          {/* QR Code */}
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6 text-center">
              {displayQRCode && (
                <img 
                  src={displayQRCode} 
                  alt="Coupon QR Code"
                  className="w-48 h-48 mx-auto rounded-lg border border-border/20"
                />
              )}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  {claim?.is_used ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-600">Used</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Valid until presented</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Show this QR code to the merchant to redeem your coupon
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleDownload}
              variant="outline" 
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            {navigator.share && (
              <Button 
                onClick={handleShare}
                variant="outline" 
                className="flex-1 gap-2"
              >
                <Share className="w-4 h-4" />
                Share
              </Button>
            )}
          </div>

          {/* Terms */}
          {(item as any).terms && (
            <div className="bg-muted/30 rounded-lg p-3">
              <h4 className="font-medium text-sm text-foreground mb-2">Terms & Conditions:</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{(item as any).terms}</p>
            </div>
          )}

          <Button 
            onClick={onClose}
            className="w-full mt-4"
            variant="default"
          >
            Go Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};