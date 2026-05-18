"use client";

import dynamic from "next/dynamic";

const LoginForm = dynamic(() => import("./login-form"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function LoginPage() {
  return <LoginForm />;
}
