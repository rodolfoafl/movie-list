import { redirect } from "next/navigation";

import { auth } from "./auth";

export async function verifySession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return { userId: session.user.id };
}
