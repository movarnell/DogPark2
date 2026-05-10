export interface ParkType {
    id?: string | number;
    parkId?: string;
    source?: "google" | "local";
    googlePlaceId?: string;
    park_name?: string;
    name?: string;
    location?: string;
    address?: string;
    city?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    size?: string;
    is_public?: boolean;
    amenities?: string[] | string;
    notes?: string;
    image_URL?: string;
    photoUrl?: string;
    rating?: number | null;
    userRatingCount?: number;
    googleMapsUri?: string;
    websiteUri?: string;
    phoneNumber?: string;
    openingHours?: string[];
    attributions?: Array<{ provider?: string; providerUri?: string }>;
    googleDetailsSource?: "live" | "cache";
    googleDetailsWarning?: string;
    busyTimes?: {
        source: "first_party_scheduled_visits";
        windowDays: number;
        generatedAt: string;
        totalDogs: number;
        peak: {
            date: string;
            weekday: string;
            hour: number;
            hourLabel: string;
            dogCount: number;
            ownerCount: number;
            intensity: number;
            label: string;
        } | null;
        days: Array<{
            date: string;
            weekday: string;
            totalDogs: number;
            peakHour: string;
            peakDogCount: number;
            slots: Array<{
                hour: number;
                hourLabel: string;
                dogCount: number;
                ownerCount: number;
                intensity: number;
                label: string;
            }>;
        }>;
    } | null;
    community?: {
        fenceStatus?: string;
        smallDogArea?: boolean;
        largeDogArea?: boolean;
        waterAvailable?: boolean;
        shadeAvailable?: boolean;
        lightingAvailable?: boolean;
        surface?: string;
        accessibilityNotes?: string;
        safetyNotes?: string;
        rules?: string;
    };
}
