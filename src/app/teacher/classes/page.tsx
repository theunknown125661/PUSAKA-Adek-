"use client";
// Redirect to teacher dashboard which shows classes
import { redirect } from "next/navigation";
export default function ClassesPage() { redirect("/teacher"); }
