import type { Metadata } from "next";
import CheckinCheckout from "@/components/checkin-checkout";
import "./checkin-checkout.css";

export const metadata: Metadata = {
  title: "Check-in / Check-out | Asset Management",
};

export default function CheckinCheckoutPage() {
  return <CheckinCheckout />;
}
