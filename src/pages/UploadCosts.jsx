import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function parseCSV(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.some((c) => String(c).trim() !== "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        pushField();
        i++;
        continue;
      }
      if (c === "\n") {
        pushField();
        pushRow();
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      field += c;
      i++;
    }
  }

  pushField();
  pushRow();

  return rows;
}

export default function UploadCosts({ locationId }) {
  const [raw, setRaw] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const validRows = useMemo(() => {
    return raw
      .map((r) => ({
        product_name: String(r.product_name ?? "").trim(),
        unit_cost: Number(r.unit_cost),
        currency: String(r.currency ?? "ARS").trim() || "ARS",
        active_from: r.active_from ? String(r.active_from).slice(0, 10) : null,
      }))
      .filter((r) => r.product_name && Number.isFinite(r.unit_cost) && r.unit_cost >= 0);
  }, [raw]);

  const onFile = async (file) => {
    setMsg("");
    setRaw([]);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMsg("Por seguridad, solo aceptamos CSV. Exportalo desde Excel como .csv.");
      return;
    }

    const text = await file.text();
    const table = parseCSV(text);

    if (table.length < 2) {
      setMsg("CSV vacío o sin datos.");
      return;
    }

    const headers = table[0].map((h) => String(h).trim().toLowerCase());
    const idx = (name) => headers.indexOf(name);

    const iProduct = idx("product_name");
    const iCost = idx("unit_cost");
    const iCur = idx("currency");
    const iFrom = idx("active_from");

    if (iProduct === -1 || iCost === -1) {
      setMsg("El CSV debe tener columnas mínimas: product_name y unit_cost.");
      return;
    }

    const data = table.slice(1).map((cells) => ({
      product_name: cells[iProduct],
      unit_cost: cells[iCost],
      currency: iCur !== -1 ? cells[iCur] : "ARS",
      active_from: iFrom !== -1 ? cells[iFrom] : null,
    }));

    setRaw(data);
  };

  const upload = async () => {
    setMsg("");

    if (!locationId) {
      setMsg("No pude detectar location_id del admin. Revisá location_users.");
      return;
    }
    if (validRows.length === 0) {
      setMsg("No hay filas válidas para cargar (revisá product_name y unit_cost).");
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const payload = validRows.map((r) => ({
        location_id: locationId,
        product_name: r.product_name,
        unit_cost: r.unit_cost,
        currency: r.currency,
        active_from: r.active_from ?? today,
        is_active: true,
      }));

      const chunkSize = 300;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("product_costs").insert(chunk);
        if (error) throw error;
      }

      setMsg(`OK: cargadas ${payload.length} filas en product_costs.`);
    } catch (e) {
      setMsg(e.message ?? "Error al cargar costos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="sectionTitle">Cargar costos (CSV)</div>
      <div className="hint">
        Columnas mínimas: <b>product_name</b>, <b>unit_cost</b>. Opcional: currency, active_from.
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept=".csv" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn" onClick={upload} disabled={loading || validRows.length === 0}>
          {loading ? "Cargando..." : "Subir a Supabase"}
        </button>
        {msg && (
          <span style={{ fontWeight: 800, color: msg.startsWith("OK") ? "#166534" : "#b91c1c" }}>
            {msg}
          </span>
        )}
      </div>

      <div style={{ marginTop: 12 }} className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>product_name</th>
              <th style={{ textAlign: "right" }}>unit_cost</th>
              <th>currency</th>
              <th>active_from</th>
            </tr>
          </thead>
          <tbody>
            {validRows.slice(0, 50).map((r, i) => (
              <tr key={i}>
                <td>{r.product_name}</td>
                <td style={{ textAlign: "right" }}>{r.unit_cost}</td>
                <td>{r.currency}</td>
                <td>{r.active_from ?? "(hoy)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validRows.length > 50 && (
        <div className="hint" style={{ marginTop: 8 }}>
          Mostrando 50 de {validRows.length}.
        </div>
      )}
    </div>
  );
}
