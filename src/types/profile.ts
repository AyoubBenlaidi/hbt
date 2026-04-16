export type UserProfile = {
  id: string;
  pseudo: string;
  description?: string | null;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
};

export const AVATAR_COLORS = [
  "#4A7C59", // muted green
  "#6B4F4F", // warm brown
  "#3E5C76", // desaturated blue
  "#7C6A5A", // taupe
  "#5A6C57", // olive
  "#6A5A7C", // muted purple
];

export function getInitials(pseudo: string): string {
  return pseudo
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
