-- Add coupon_code column to user_coupons table for one-time use codes
ALTER TABLE user_coupons ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- Add is_active column to track if coupon is still valid
ALTER TABLE user_coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index on coupon_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_coupons_code ON user_coupons(coupon_code);

-- Add coupon_code column to user_coupon_claims for storing the code used
ALTER TABLE user_coupon_claims ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- Function to generate unique coupon code
CREATE OR REPLACE FUNCTION generate_coupon_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM user_coupons WHERE coupon_code = code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;