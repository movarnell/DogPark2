export interface ParkType {
    id: number;
    park_name: string;
    location: string;
    address: string;
    size: string;
    isPublic: boolean;
    amenities: string[];
    notes: string;
    image_URL: string;
}