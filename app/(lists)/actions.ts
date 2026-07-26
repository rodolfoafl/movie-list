"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";

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

export async function renameList(
  listId: string,
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
    .where(
      and(
        sql`lower(trim(${lists.name})) = lower(trim(${name}))`,
        ne(lists.id, listId)
      )
    )
    .limit(1);

  if (existing) {
    return { error: DUPLICATE_NAME_ERROR };
  }

  try {
    await db
      .update(lists)
      .set({ name, updatedAt: new Date() })
      .where(eq(lists.id, listId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/${listId}`);
}

export async function deleteList(listId: string): Promise<void> {
  await verifySession();

  // A single DELETE is already atomic in Postgres — ON DELETE CASCADE
  // removes this list's movie_entries within the same implicit transaction.
  await db.delete(lists).where(eq(lists.id, listId));

  revalidatePath("/");
}
