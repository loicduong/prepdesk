export function displayName(user: { email?: string | null; is_anonymous?: boolean }): string {
  if (user.is_anonymous || !user.email) return "Guest";
  return user.email;
}
