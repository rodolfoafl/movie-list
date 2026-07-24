"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { isUniqueViolation } from "@/app/lib/db/errors";
import { lists } from "@/app/lib/db/schema";

export type ActionState = { error?: string } | undefined;

const NAME_MAX_LENGTH = 60;
const DUPLICATE_NAME_ERROR = "Este nome já está em uso.";

export async function createList(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await verifySession();

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!name) {
    return { error: "Informe um nome para a lista." };
  }

  if (name.length > NAME_MAX_LENGTH) {
    return {
      error: `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
    };
  }

  const [existing] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(sql`lower(trim(${lists.name})) = lower(trim(${name}))`)
    .limit(1);

  if (existing) {
    return { error: DUPLICATE_NAME_ERROR };
  }

  try {
    await db.insert(lists).values({ name });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    throw error;
  }

  revalidatePath("/");
}
