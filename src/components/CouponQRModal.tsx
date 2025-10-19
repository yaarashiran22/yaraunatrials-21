import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, Share, Clock, CheckCircle, Copy } from "lucide-react";
import { UserCoupon } from "@/hooks/useUserCoupons";
import { CouponClaim } from "@/hooks/useCouponClaims";
import { toast } from "@/hooks/use-toast";

interface CouponQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoupon?: UserCoupon | null;
  claim?: CouponClaim | null;
  couponCode?: string;
}

export const CouponQRModal = ({ isOpen, onClose, userCoupon, claim, couponCode }: CouponQRModalProps) => {
  const item = userCoupon;
  const displayCode = claim?.coupon_code || couponCode;
  
  if (!item || !displayCode) return null;

  const handleCopyCode = () => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode);
      toast({
        title: "Copied!",
        description: "Coupon code copied to clipboard",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Coupon: ${item.title}`,
          text: `Check out this coupon from ${item.business_name || item.title}! Code: ${displayCode}`,
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
            <Ticket className="w-6 h-6 text-primary" />
            Your Coupon Code
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

          {/* Coupon Code Display */}
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6 text-center">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-8 mb-4">
                <div className="text-4xl font-black text-foreground tracking-widest mb-2 font-mono">
                  {displayCode}
                </div>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-3"
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </Button>
              </div>
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
                  Show this code to the merchant to redeem your coupon
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleCopyCode}
              variant="outline" 
              className="flex-1 gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Code
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