import { redirect } from "next/navigation";

export default function HomePage() {
  // `proxy.ts` sends anonymous traffic to /login before this runs.
  redirect("/todos");
}
