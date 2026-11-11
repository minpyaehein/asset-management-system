import type { Metadata } from "next";
import Profile from "@/components/profile";
import "./profile.css";

export const metadata: Metadata = {
  title: "My Profile | Asset Management",
};

export default function ProfilePage() {
  return <Profile />;
}
