export interface AnnounceFormData {
  title: string;
  description: string;
  category: string;
  customCategory?: string;
  photo?: File;
  location: string;
  latitude?: number;
  longitude?: number;
  expiresAt?: string;
  quantity: number;
  priceType: 'free' | 'unit' | 'wholesale';
  price?: number;

}
