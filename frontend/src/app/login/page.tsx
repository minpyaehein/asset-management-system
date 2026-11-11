"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

type LoginResponse = {
  user: {
    id: number;
    username: string;
    fullName: string;
    email: string | null;
    status: "Active" | "Inactive";
  };
  role: {
    id: number;
    name: string;
  };
  accessRole: "Admin" | "Agent";
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const role =
      sessionStorage.getItem("assetManagementRole") ??
      sessionStorage.getItem("stockwiseRole");

    if (role === "Admin") {
      router.replace("/dashboard");
    } else if (role === "Agent") {
      router.replace("/user-dashboard");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;

        throw new Error(message || "Username or password is incorrect.");
      }

      const result = body as LoginResponse;

      sessionStorage.setItem("assetManagementRole", result.accessRole);
      sessionStorage.setItem("assetManagementName", result.user.fullName);
      sessionStorage.setItem("assetManagementUserId", String(result.user.id));
      sessionStorage.setItem("assetManagementUsername", result.user.username);
      sessionStorage.setItem("assetManagementDatabaseRole", result.role.name);
      sessionStorage.setItem("assetManagementDatabaseRoleId", String(result.role.id));

      sessionStorage.setItem("stockwiseRole", result.accessRole);
      sessionStorage.setItem("stockwiseName", result.user.fullName);

      router.replace(result.accessRole === "Admin" ? "/dashboard" : "/user-dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art" aria-label="Golden Pride introduction">
        <div className="brand">
          <span className="brand-mark">
            <Image
              src="/logo.png"
              alt="Golden Pride logo"
              width={42}
              height={42}
              priority
            />
          </span>

          <span className="brand-name">
            Golden Pride
            <small>ASSET MANAGEMENT</small>
          </span>
        </div>

        <div className="login-art-content">
          <div className="login-eyebrow">ASSET MANAGEMENT, SIMPLIFIED</div>

          <h1>
            Every asset.
            <br />
            One clear view.
          </h1>

          <p>
            Manage company equipment, software licenses, employee assignments,
            and maintenance records in one practical workspace.
          </p>
        </div>

        <small className="login-edition">
          Golden Pride · Asset Management
        </small>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to Asset Management</h2>
          <p className="login-description">
            Enter the username and password stored in User Management.
          </p>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button
            className="login-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In →"}
          </button>

          <div className="login-error" role="alert" aria-live="polite">
            {error}
          </div>
        </form>
      </section>
    </main>
  );
}
