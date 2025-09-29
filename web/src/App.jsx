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
      <div style={s
