"use client";

export function VendorLogoutButton() {
  async function logout() {
    await fetch("/api/vendedor/logout", { method: "POST" });
    window.location.href = "/vendedor";
  }
  return <button type="button" className="button button-small vendor-logout" onClick={logout}>Cerrar sesión</button>;
}
