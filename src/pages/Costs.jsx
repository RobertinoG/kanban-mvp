import UploadCosts from "./UploadCosts";

export default function Costs({ role, locationId }) {
  if (role !== "admin") {
    return (
      <div className="card" style={{ padding: 14 }}>
        <b>Sin acceso.</b>
        <div className="hint">Costos está disponible solo para admin.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <UploadCosts locationId={locationId} />
    </div>
  );
}
