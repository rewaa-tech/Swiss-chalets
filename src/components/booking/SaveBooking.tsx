"use client";
import { useEffect } from "react";
import { saveMyBooking } from "./client-utils";
export default function SaveBooking({ token, unit, date }: { token: string; unit: string; date: string }) {
  useEffect(() => { saveMyBooking({ token, unit, date, at: Date.now() }); }, [token, unit, date]);
  return null;
}
