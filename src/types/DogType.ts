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
    avatarUrl?: string;
    notes?: string;
}
