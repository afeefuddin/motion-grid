import { NextResponse } from "next/server";

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
