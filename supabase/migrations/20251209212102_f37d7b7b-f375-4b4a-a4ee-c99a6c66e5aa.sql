-- Allow anyone (including unauthenticated users) to upload images to the item-images bucket
CREATE POLICY "Anyone can upload event images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'item-images');

-- Allow anyone to update their uploaded images
CREATE POLICY "Anyone can update event images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'item-images');

-- Allow anyone to delete event images
CREATE POLICY "Anyone can delete event images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'item-images');