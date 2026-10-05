import "server-only";

import { getAuth, type Auth } from "firebase-admin/auth";

import { getAdminApp } from "@/lib/firebase/admin";

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
