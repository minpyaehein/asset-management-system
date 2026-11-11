"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Master from "./master";

type UserStatus = "Active" | "Inactive";

type ProfileRecord = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  status: UserStatus;
  roleId: number;
  role: {
    id: number;
    name: string;
    isActive: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type ProfileForm = {
  fullName: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    email: "",
  });
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;

        throw new Error(message || "Unable to load profile.");
      }

      const user = body as ProfileRecord;
      setProfile(user);
      setForm({
        fullName: user.fullName,
        email: user.email ?? "",
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const role =
      sessionStorage.getItem("assetManagementRole") ??
      sessionStorage.getItem("stockwiseRole");

    const userId = sessionStorage.getItem("assetManagementUserId");

    if ((role !== "Admin" && role !== "Agent") || !userId) {
      router.replace("/login");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecking(false);
    void loadProfile(userId);
  }, [loadProfile, router]);

  function startEditing() {
    if (!profile) return;

    setForm({
      fullName: profile.fullName,
      email: profile.email ?? "",
    });
    setError("");
    setSuccess("");
    setEditing(true);
  }

  function cancelEditing() {
    if (profile) {
      setForm({
        fullName: profile.fullName,
        email: profile.email ?? "",
      });
    }

    setEditing(false);
    setError("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    const fullName = form.fullName.trim();

    if (!fullName) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/users/${profile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName,
          email: form.email.trim() || null,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;

        throw new Error(message || "Unable to update profile.");
      }

      const updatedProfile = body as ProfileRecord;
      setProfile(updatedProfile);
      setForm({
        fullName: updatedProfile.fullName,
        email: updatedProfile.email ?? "",
      });

      sessionStorage.setItem(
        "assetManagementName",
        updatedProfile.fullName,
      );
      sessionStorage.setItem(
        "stockwiseName",
        updatedProfile.fullName,
      );

      setEditing(false);
      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    if (passwordForm.newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/users/${profile.id}/change-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;

        throw new Error(message || "Unable to change password.");
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
      setSuccess("Password changed successfully.");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Unable to change password.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  if (checking) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Checking access...</p>
        </div>
      </main>
    );
  }

  return (
    <Master>
      <section className="content profile-page-content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Account</div>
            <h1>My Profile</h1>
            <p>View and update your personal account information.</p>
          </div>

          {!editing && profile && (
            <button
              className="btn primary"
              type="button"
              onClick={startEditing}
            >
              Edit Profile
            </button>
          )}
        </div>

        {error && (
          <div className="profile-message profile-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="profile-message profile-success" role="status">
            {success}
          </div>
        )}

        <div className="panel profile-panel">
          {loading ? (
            <div className="profile-loading">Loading profile...</div>
          ) : !profile ? (
            <div className="profile-loading">Profile is unavailable.</div>
          ) : (
            <>
              <div className="profile-hero">
                <div className="profile-avatar" aria-hidden="true">
                  {profile.fullName.trim().charAt(0).toUpperCase() || "U"}
                </div>

                <div className="profile-identity">
                  <h2>{profile.fullName}</h2>
                  <p>@{profile.username}</p>

                  <div className="profile-badges">
                    <span className="profile-role-badge">
                      {profile.role?.name || "Unassigned"}
                    </span>

                    <span
                      className={
                        profile.status === "Active"
                          ? "profile-status-badge active"
                          : "profile-status-badge inactive"
                      }
                    >
                      {profile.status}
                    </span>
                  </div>
                </div>
              </div>

              {editing ? (
                <form className="profile-form" onSubmit={saveProfile}>
                  <div className="profile-form-grid">
                    <div className="profile-field">
                      <label htmlFor="profile-username">Username</label>
                      <input
                        id="profile-username"
                        value={profile.username}
                        disabled
                        readOnly
                      />
                      <small>Username cannot be changed from this page.</small>
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-role">Role</label>
                      <input
                        id="profile-role"
                        value={profile.role?.name || "Unassigned"}
                        disabled
                        readOnly
                      />
                      <small>Role assignments are managed by an administrator.</small>
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-full-name">Full Name</label>
                      <input
                        id="profile-full-name"
                        value={form.fullName}
                        maxLength={150}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-email">Email</label>
                      <input
                        id="profile-email"
                        type="email"
                        value={form.email}
                        maxLength={255}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="profile-form-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                    >
                      Cancel
                    </button>

                    <button
                      className="btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profile-detail-grid">
                  <div className="profile-detail-item">
                    <span>Username</span>
                    <strong>{profile.username}</strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Full Name</span>
                    <strong>{profile.fullName}</strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Email</span>
                    <strong>{profile.email || "Not provided"}</strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Role</span>
                    <strong>{profile.role?.name || "Unassigned"}</strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Status</span>
                    <strong>{profile.status}</strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Created</span>
                    <strong>
                      {new Date(profile.createdAt).toLocaleString()}
                    </strong>
                  </div>

                  <div className="profile-detail-item">
                    <span>Last Updated</span>
                    <strong>
                      {new Date(profile.updatedAt).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}

              <section className="profile-password-section">
                <div className="profile-password-heading">

                  {!showPasswordForm && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccess("");
                        setShowPasswordForm(true);
                      }}
                    >
                      Change Password
                    </button>
                  )}
                </div>

                {showPasswordForm && (
                  <form className="profile-password-form" onSubmit={changePassword}>
                    <div className="profile-password-grid">
                      <div className="profile-field">
                        <label htmlFor="current-password">Current Password</label>
                        <input
                          id="current-password"
                          type="password"
                          autoComplete="current-password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              currentPassword: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="profile-field">
                        <label htmlFor="new-password">New Password</label>
                        <input
                          id="new-password"
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="profile-field">
                        <label htmlFor="confirm-password">Confirm New Password</label>
                        <input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="profile-password-actions">
                      <button
                        className="btn"
                        type="button"
                        disabled={changingPassword}
                        onClick={() => {
                          setPasswordForm({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                          setShowPasswordForm(false);
                          setError("");
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        className="btn primary"
                        type="submit"
                        disabled={changingPassword}
                      >
                        {changingPassword
                          ? "Changing..."
                          : "Update Password"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </Master>
  );
}
