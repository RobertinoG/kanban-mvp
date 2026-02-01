import UploadCosts from "./UploadCosts";

export default function Costs({ role, locationId }) {
  if (role !== "admin") {
    return (
      <div style={{ padding: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16 }}>
        No tenés permiso para ver Costos.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16 }}>
      <UploadCosts locationId={locationId} />
    </div>
  );
}
