import UploadCosts from "./UploadCosts";

export default function Costs({ role, locationId }) {
  const allowed = role === "admin";

  if (!allowed) {
    return (
      <div style={{ padding: 14, background: "#fff", border: "1px solid #e6eaf2", borderRadius: 16 }}>
        No autorizado.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e6eaf2",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 10px 30px rgba(16,24,40,.06)",
      }}
    >
      <UploadCosts locationId={locationId} />
    </div>
  );
}
