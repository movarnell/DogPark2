export interface DogType {
    id: string;
    ownerId: string | number;
    dog_name: string;
    name?: string;
    isFriendly: boolean;
    isPuppy: boolean;
    isPublic?: boolean;
    size: string;
    breed?: string;
    breedKey?: string;
    energyLevel?: "low" | "moderate" | "high";
    playStyle?: "gentle" | "balanced" | "rough";
    socialComfort?: "shy" | "selective" | "social";
    preferredDogSizes?: string[];
    avatarUrl?: string;
    notes?: string;
}
