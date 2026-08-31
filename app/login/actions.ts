"use server";

import { CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/app/lib/auth";

// `email` is echoed back so the form can repopulate that field after a failed
// attempt: React resets an uncontrolled form once its action settles, which
// otherwise clears the address too. Only the password should need retyping.
export type SignInState = { error?: string; email?: string } | undefined;

export async function signInAction(
  _state: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = formData.get("email");

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return {
        error: "E-mail ou senha inválidos.",
        // Never echo the password back — only the address.
        email: typeof email === "string" ? email : undefined,
      };
    }
    throw error;
  }

  redirect("/");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
