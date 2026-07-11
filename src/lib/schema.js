import { z } from 'zod';

export const PublicListingSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional().nullable(),
  age: z.union([z.string(), z.number()]).optional().nullable(),
  location: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  priceLabel: z.string().optional().nullable(),
  price: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  metrics: z.record(z.any()).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  photo_urls: z.array(z.string()).optional().nullable(),
  allPhotoUrls: z.array(z.string()).optional().nullable(),
  rating: z.union([z.string(), z.number()]).optional().nullable(),
  reviews: z.union([z.string(), z.number()]).optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  postedAt: z.string().optional().nullable(),
  posted_at: z.string().optional().nullable(),
  sourceChannel: z.string().optional().nullable(),
  source_channel: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  hours: z.string().optional().nullable(),
  lineUrl: z.string().optional().nullable(),
  line_url: z.string().optional().nullable(),
  telegramUrl: z.string().optional().nullable(),
  telegram_url: z.string().optional().nullable(),
  mapsUrl: z.string().optional().nullable(),
  maps_url: z.string().optional().nullable(),
  latitude: z.union([z.string(), z.number()]).optional().nullable(),
  longitude: z.union([z.string(), z.number()]).optional().nullable(),
  rawText: z.string().optional().nullable(),
  raw_text: z.string().optional().nullable(),
  isSafeImage: z.boolean().optional().nullable(),
  is_safe_image: z.boolean().optional().nullable(),
  mentionCount: z.union([z.string(), z.number()]).optional().nullable(),
  mention_count: z.union([z.string(), z.number()]).optional().nullable(),
  credibility: z.union([z.string(), z.number()]).optional().nullable(),
  dataSource: z.string().optional().nullable(),
  data_source: z.string().optional().nullable(),
}).passthrough();

export const ListingsPayloadSchema = z.array(PublicListingSchema);

export function validateListingsPayload(data) {
  try {
    return ListingsPayloadSchema.parse(data);
  } catch (error) {
    console.error('Zod validation failed for listings payload:', error);
    // Return empty array on failure so it falls back cleanly
    return [];
  }
}
