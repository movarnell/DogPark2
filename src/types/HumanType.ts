export interface HumanType {
    id: number | string;
    human_name?: string;
    fullName?: string;
    email: string;
    username: string;
    role?: "member" | "moderator" | "admin";
    bio?: string;
    homeCity?: string;
    avatarUrl?: string;
    messagesEnabled?: boolean;
    activityVisibility?: "owner_and_dog" | "dog_only" | "anonymous";
}
