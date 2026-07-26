"use server";

import { CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/app/lib/auth";

export type SignInState = { error?: string } | undefined;

export async function signInAction(
  _state: SignInState,
  formData: FormData
): Promise<SignInState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: "E-mail ou senha inválidos." };
    }
    throw error;
  }

  redirect("/");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
