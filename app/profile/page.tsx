import type { Metadata } from "next";
import { ProfileClient } from "@/components/library/profile-client";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your KURO profile and preferences.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
