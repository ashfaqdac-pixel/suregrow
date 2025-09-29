import React, { useEffect, useState } from "react";

const API = (path, opts = {}) =>
  fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());

export default function App() {
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("simulate");

  const t = (en, bn) => (lang === "en" ? en : bn);

  return (
    <div
      style={{
        ...s.page,
        background: dark ? "#0b1210" : "#f7faf5",
        color: dark ? "#f3f4f6" : "#0e1e16",
      }}
    >
      <h1>SureGrow</h1>

      <div style={s.bar}>
        {[
          "investors",
          "batches",
          "money",
          "cows",
          "simulate",
          "close",
          "reports",
          "settings",
        ].map((tname) => (
          <button
            key={tname}
            style={s.btn(tab === tname)}
            onClick={() => setTab(tname)}
          >
            {tname.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "investors" && <Investors />}
      {tab === "batches" && <Batches />}
      {tab === "money" && <Money />}
      {tab === "cows" && <Cows />}
      {tab === "simulate" && <Simulate />}
      {tab === "close" && <CloseBatch />}
      {tab === "reports" && <Reports />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

/* ---------------- Investors ---------------- */

function Investors() {
  const [inv, setInv] = useState({ name: "", phone: "", email: "" });
  const [commit, setCommit] = useState({
    investor_id: "",
    batch_id: "",
    amount: "",
    start_date: "",
    end_date: "",
    frequency: "monthly",
  });
  const [preview, setPreview] = useState("");
  const [investors, setInvestors] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    API("/investors").then(setInvestors);
    API("/batches").then(setBatches);
  }, []);

  return (
    <div>
      <div style={s.card}>
        <h2>Add Investor</h2>
        <div style={s.row}>
          <input
            style={s.input}
            placeholder="Full name"
            value={inv.name}
            onChange={(e) => setInv({ ...inv, name: e.target.value })}
          />
          <input
            style={s.input}
            placeholder="Phone"
            value={inv.phone}
            onChange={(e) => setInv({ ...inv, phone: e.target.value })}
          />
          <input
            style={s.input}
            placeholder="Email"
            value={inv.email}
            onChange={(e) => setInv({ ...inv, email: e.target.value })}
          />
          <button
            style={s.btn(true)}
            onClick={async () => {
              await API("/investors", {
                method: "POST",
                body: JSON.stringify(inv),
              });
              setInv({ name: "", phone: "", email: "" });
              setInvestors(await API("/investors"));
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div style={s.card}>
        <h2>Add Commitment (auto-tier)</h2>
        <div style={s.row}>
          <select
            style={s.input}
            value={commit.investor_id}
            onChange={(e) =>
              setCommit({ ...commit, investor_id: e.target.value })
            }
          >
            <option value="">Investor</option>
            {investors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>

          <select
            style={s.input}
            value={commit.batch_id}
            onChange={(e) => setCommit({ ...commit, batch_id: e.target.value })}
          >
            <option value="">Batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>

          <input
            style={s.input}
            type="number"
            placeholder="Amount (Tk)"
            value={commit.amount}
            onChange={(e) => setCommit({ ...commit, amount: e.target.value })}
          />
          <input
            style={s.input}
            type="date"
            value={commit.start_date}
            onChange={(e) =>
              setCommit({ ...commit, start_date: e.target.value })
            }
          />
          <input
            style={s.input}
            type="date"
            value={commit.end_date}
            onChange={(e) => setCommit({ ...commit, end_date: e.target.value })}
          />
          <select
            style={s.input}
            value={commit.frequency}
            onChange={(e) =>
              setCommit({ ...commit, frequency: e.target.value })
            }
          >
            <option value="monthly">Monthly ROI</option>
            <option value="quarterly">Quarterly ROI</option>
            <option value="closure">Lump sum at closure</option>
          </select>

          <button
            style={s.btn(true)}
            onClick={async () => {
              const res = await API("/commitments", {
                method: "POST",
                body: JSON.stringify(commit),
              });
              setPreview(
                `Tier ${res.tier} | ROI Corridor ${res.roi_min_pct}% – ${res.roi_max_pct}% per month`
              );
            }}
          >
            Save Commitment
          </button>
        </div>

        <div style={{ marginTop: 8, color: "#334155" }}>{preview}</div>
      </div>
    </div>
  );
}

/* ---------------- Batches ---------------- */

function Batches() {
  const [b, setB] = useState({ name: "", start_date: "", closure_date: "" });
  const [list, setList] = useState([]);

  useEffect(() => {
    API("/batches").then(setList);
  }, []);

  return (
    <div style={s.card}>
      <h2>Create Batch</h2>
      <div style={s.row}>
        <input
          style={s.input}
          placeholder="Batch name (e.g., Eid 2026)"
          value={b.name}
          onChange={(e) => setB({ ...b, name: e.target.value })}
        />
        <input
          style={s.input}
          type="date"
          value={b.start_date}
          onChange={(e) => setB({ ...b, start_date: e.target.value })}
        />
        <input
          style={s.input}
          type="date"
          value={b.closure_date}
          onChange={(e) => setB({ ...b, closure_date: e.target.value })}
        />
        <button
          style={s.btn(true)}
          onClick={async () => {
            await API("/batches", { method: "POST", body: JSON.stringify(b) });
            setB({ name: "", start_date: "", closure_date: "" });
            setList(await API("/batches"));
          }}
        >
          Save
        </button>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.thtd}>Code</th>
            <th style={s.thtd}>Name</th>
            <th style={s.thtd}>Start</th>
            <th style={s.thtd}>Close</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id}>
              <td style={s.thtd}>{x.code}</td>
              <td style={s.thtd}>{x.name}</td>
              <td style={s.thtd}>{x.start_date}</td>
              <td style={s.thtd}>{x.closure_date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Money ---------------- */

function Money() {
  const [t, setT] = useState({
    date: "",
    direction: "out",
    wallet: "",
    category: "",
    amount: "",
    batch_id: "",
    cow_id: "",
    notes: "",
    receipt: null,
  });
  const [batches, setBatches] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [cats, setCats] = useState([]);
  const [newW, setNewW] = useState({ name: "", opening_balance: "" });
  const [newC, setNewC] = useState({ kind: "expense", name: "" });

  const [flt, setFlt] = useState({
    from: "",
    to: "",
    wallet: "",
    category: "",
    batch: "",
  });
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      setBatches(await API("/batches"));
      setWallets(await API("/wallets"));
      setCats(await API("/categories"));
      await runFilter();
    })();
  }, []);

  async function refresh() {
    setWallets(await API("/wallets"));
    setCats(await API("/categories"));
    await runFilter();
  }

  async function runFilter() {
    const q = new URLSearchParams(flt).toString();
    setRows(await API("/transactions?" + q));
  }

  async function uploadFile(f) {
    const arr = await f.arrayBuffer();
    const b64 =
      "data:" +
      (f.type || "application/octet-stream") +
      ";base64," +
      btoa(String.fromCharCode(...new Uint8Array(arr)));
    const res = await API("/upload", {
      method: "POST",
      body: JSON.stringify({
        kind: "tx_receipt",
        ref_id: "",
        filename: f.name,
        base64: b64,
      }),
    });
    return res.url || res.key;
  }

  return (
    <div>
      <div style={s.card}>
        <h2>Money In/Out</h2>
        <div style={s.row}>
          <input
            style={s.input}
            type="date"
            value={t.date}
            onChange={(e) => setT({ ...t, date: e.target.value })}
          />
          <select
            style={s.input}
            value={t.direction}
            onChange={(e) => setT({ ...t, direction: e.target.value })}
          >
            <option value="in">Money In</option>
            <option value="out">Money Out</option>
          </select>
          <select
            style={s.input}
            value={t.wallet}
            onChange={(e) => setT({ ...t, wallet: e.target.value })}
          >
            <option value="">Wallet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            style={s.input}
            value={t.category}
            onChange={(e) => setT({ ...t, category: e.target.value })}
          >
            <option value="">Category</option>
            {cats.map((c) => (
              <option key={c.id} value={c.name}>
                {(c.kind === "expense" ? "🟥" : "🟩") + " " + c.name}
              </option>
            ))}
          </select>
          <input
            style={s.input}
            type="number"
            placeholder="Amount (Tk)"
            value={t.amount}
            onChange={(e) => setT({ ...t, amount: e.target.value })}
          />
          <select
            style={s.input}
            value={t.batch_id}
            onChange={(e) => setT({ ...t, batch_id: e.target.value })}
          >
            <option value="">Batch (optional)</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </select>
          <input
            style={s.input}
            placeholder="Cow ID (optional)"
            value={t.cow_id}
            onChange={(e) => setT({ ...t, cow_id: e.target.value })}
          />
          <input
            style={{ ...s.input, minWidth: "240px" }}
            placeholder="Notes"
            value={t.notes}
            onChange={(e) => setT({ ...t, notes: e.target.value })}
          />
          <input
            style={s.input}
            type="file"
            onChange={(e) =>
              setT({ ...t, receipt: e.target.files?.[0] || null })
            }
          />
          <button
            style={s.btn(true)}
            onClick={async () => {
              let receipt_url = null;
              if (t.receipt) {
                receipt_url = await uploadFile(t.receipt);
              }
              await API("/transactions", {
                method: "POST",
                body: JSON.stringify({ ...t, receipt_url }),
              });
              alert("Saved");
              setT({ ...t, amount: "", notes: "", receipt: null });
              refresh();
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div style={s.card}>
        <h2>Wallets Overview</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.thtd}>Wallet</th>
              <th style={s.thtd}>Opening</th>
              <th style={s.thtd}>Balance</th>
            </tr>
          </thead>
        <tbody>
            {wallets.map((w) => (
              <tr key={w.id}>
                <td style={s.thtd}>{w.name}</td>
                <td style={s.thtd}>৳ {fmt(w.opening_balance || 0)}</td>
                <td style={s.thtd}>
                  <b>৳ {fmt(w.balance || 0)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.card}>
        <h3>Filter Transactions</h3>
        <div style={s.row}>
          <input
            style={s.input}
            type="date"
            value={flt.from}
            onChange={(e) => setFlt({ ...flt, from: e.target.value })}
          />
          <input
            style={s.input}
            type="date"
            value={flt.to}
            onChange={(e) => setFlt({ ...flt, to: e.target.value })}
          />
          <select
            style={s.input}
            value={flt.wallet}
            onChange={(e) => set
