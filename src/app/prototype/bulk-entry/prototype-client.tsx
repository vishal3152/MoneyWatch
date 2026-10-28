"use client";

import { useEffect, useState } from "react";

import { DecimalInput } from "@/app/components/decimal-input";
import { toDatetimeLocalValue } from "@/app/datetime-local";
import { TEXT_FIELD_MAX_LENGTH } from "@/app/form-limits";

import styles from "./prototype.module.css";

type Kind = "account" | "trades";
type Variant = "grid" | "details" | "cards";
type Entry = {
  id: number;
  type: string;
  category: string;
  amount: string;
  symbol: string;
  quantity: string;
  price: string;
  description: string;
  occurredAt: string;
};

const variants: { id: Variant; name: string }[] = [
  { id: "grid", name: "Full table" },
  { id: "details", name: "Table + details" },
  { id: "cards", name: "Row cards" }
];

function freshEntry(id: number, kind: Kind): Entry {
  return {
    id,
    type: kind === "account" ? "Expense" : "Buy",
    category: kind === "account" ? "Dining" : "",
    amount: "",
    symbol: "",
    quantity: "",
    price: "",
    description: "",
    occurredAt: toDatetimeLocalValue(new Date())
  };
}

function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  decimal = false,
  maxLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  decimal?: boolean;
  maxLength?: number;
}) {
  return (
    <label className={styles.cell}>
      <span>{label}</span>
      {decimal ? <DecimalInput value={value} placeholder={placeholder} onValueChange={onChange} /> : <input type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.cell}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function BulkEntryPrototypePage() {
  const [kind, setKind] = useState<Kind>("account");
  const [variant, setVariant] = useState<Variant>("grid");
  const [rows, setRows] = useState<Entry[]>([freshEntry(1, "account")]);
  const [notice, setNotice] = useState("");
  const [mobileEntry, setMobileEntry] = useState<Entry>(() => freshEntry(1, "account"));

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("variant");
    if (variants.some((item) => item.id === fromUrl)) setVariant(fromUrl as Variant);
  }, []);

  function chooseVariant(next: Variant) {
    setVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
  }

  function chooseKind(next: Kind) {
    setKind(next);
    setRows([freshEntry(1, next)]);
    setMobileEntry(freshEntry(1, next));
    setNotice("");
  }

  function updateRow(id: number, field: keyof Entry, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function addRow() {
    setRows((current) => [...current, freshEntry(Math.max(0, ...current.map((row) => row.id)) + 1, kind)]);
    setNotice("");
  }

  function updateMobileEntry(field: keyof Entry, value: string) {
    setMobileEntry((current) => ({ ...current, [field]: value }));
  }

  function saveSampleRows() {
    const isBlank = (row: Entry) => stock
      ? !row.symbol && !row.quantity && !row.price && !row.description
      : !row.amount && !row.description;
    const incomplete = rows.filter((row) => !isBlank(row) && (stock
      ? !row.symbol || !row.quantity || !row.price || !row.description
      : !row.amount || !row.description));
    const ready = rows.filter((row) => !isBlank(row) && !incomplete.includes(row));
    if (incomplete.length) {
      setNotice(`Complete required fields in row${incomplete.length === 1 ? "" : "s"} ${incomplete.map((row) => row.id).join(", ")}.`);
    } else if (!ready.length) {
      setNotice("Add at least one complete row. Empty rows are skipped.");
    } else {
      setNotice(`Sample only — ${ready.length} ${ready.length === 1 ? "row" : "rows"} ready to save. Empty rows are skipped.`);
    }
  }

  function changeVariant(offset: number) {
    const index = variants.findIndex((item) => item.id === variant);
    chooseVariant(variants[(index + offset + variants.length) % variants.length].id);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") changeVariant(-1);
      if (event.key === "ArrowRight") changeVariant(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const stock = kind === "trades";
  const title = stock ? "Add trades" : "Add income or expenses";

  function rowFields(row: Entry, detailOnly = false) {
    if (stock) {
      return <>
        {!detailOnly && <SelectField label="Type *" value={row.type} options={["Buy", "Sell"]} onChange={(value) => updateRow(row.id, "type", value)} />}
        {!detailOnly && <TextField label="Symbol *" value={row.symbol} placeholder="e.g. RELIANCE" maxLength={TEXT_FIELD_MAX_LENGTH} onChange={(value) => updateRow(row.id, "symbol", value)} />}
        {!detailOnly && <TextField label="Quantity *" value={row.quantity} placeholder="0" type="number" onChange={(value) => updateRow(row.id, "quantity", value)} />}
        {!detailOnly && <TextField label="Price / share *" value={row.price} placeholder="0.00" decimal onChange={(value) => updateRow(row.id, "price", value)} />}
        {(detailOnly || variant === "grid") && <TextField label="Description *" value={row.description} placeholder="Trade note" maxLength={TEXT_FIELD_MAX_LENGTH} onChange={(value) => updateRow(row.id, "description", value)} />}
        {(detailOnly || variant === "grid") && <TextField label="Date & time *" value={row.occurredAt} type="datetime-local" onChange={(value) => updateRow(row.id, "occurredAt", value)} />}
      </>;
    }
    return <>
      {!detailOnly && <SelectField label="Type *" value={row.type} options={["Expense", "Income"]} onChange={(value) => { updateRow(row.id, "type", value); updateRow(row.id, "category", value === "Income" ? "Salary" : "Dining"); }} />}
      {!detailOnly && <SelectField label="Category *" value={row.category} options={row.type === "Income" ? ["Salary", "Investment", "Other"] : ["Dining", "Groceries", "Transport"]} onChange={(value) => updateRow(row.id, "category", value)} />}
      {!detailOnly && <TextField label="Amount * · AED" value={row.amount} placeholder="0.00" decimal onChange={(value) => updateRow(row.id, "amount", value)} />}
      {detailOnly && <TextField label="Description *" value={row.description} placeholder="What was this for?" maxLength={TEXT_FIELD_MAX_LENGTH} onChange={(value) => updateRow(row.id, "description", value)} />}
      {detailOnly && <TextField label="Date & time *" value={row.occurredAt} type="datetime-local" onChange={(value) => updateRow(row.id, "occurredAt", value)} />}
      {!detailOnly && variant === "grid" && <TextField label="Description *" value={row.description} placeholder="What was this for?" maxLength={TEXT_FIELD_MAX_LENGTH} onChange={(value) => updateRow(row.id, "description", value)} />}
      {!detailOnly && variant === "grid" && <TextField label="Date & time *" value={row.occurredAt} type="datetime-local" onChange={(value) => updateRow(row.id, "occurredAt", value)} />}
    </>;
  }

  function renderRow(row: Entry) {
    if (variant === "cards") {
      return <article className={styles.entryCard} key={row.id}>
        <div className={styles.cardTop}><span className={styles.rowNumber}>Row {row.id}</span><button className={styles.remove} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`Remove row ${row.id}`}>Remove</button></div>
        <div className={styles.cardFields}>
          {rowFields(row)}
          <TextField label="Description *" value={row.description} placeholder={stock ? "Trade note" : "What was this for?"} onChange={(value) => updateRow(row.id, "description", value)} />
          <TextField label="Date & time *" value={row.occurredAt} type="datetime-local" onChange={(value) => updateRow(row.id, "occurredAt", value)} />
        </div>
      </article>;
    }
    return <div className={styles.rowGroup} key={row.id}>
      <div className={`${styles.dataRow} ${stock ? variant === "details" ? styles.tradeCompactColumns : styles.tradeColumns : variant === "grid" ? styles.accountColumns : styles.compactColumns}`}>
        <span className={styles.rowNumber}>#{row.id}</span>
        {rowFields(row)}
        <button className={styles.remove} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`Remove row ${row.id}`}>×</button>
      </div>
      {variant === "details" && <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Row {row.id} details</span>
        {rowFields(row, true)}
      </div>}
    </div>;
  }

  return <main className={`pw-main ${styles.main}`}>
    <div className={styles.content}>
    <div className={styles.prototypeTag}>UI SAMPLE · Nothing will be saved</div>
    <header className={styles.pageHeading}>
      <a className={styles.backLink} href="#">← Back to {stock ? "share trading account" : "account"}</a>
      <h1>{title}</h1>
      <p>Enter several items in one go. Add a row for each {stock ? "trade" : "transaction"}, then save them together.</p>
    </header>

    <section className={styles.accountBar} aria-label="Sample account">
      <div><span className={styles.eyebrow}>ACCOUNT</span><strong>{stock ? "Long-term investing · Emirates NBD Securities" : "Everyday account · Emirates NBD"}</strong></div>
      <span className={styles.currency}>{stock ? "AED" : "AED"}</span>
    </section>

    <div className={styles.kindSwitch} role="group" aria-label="Choose entry type">
      <button className={kind === "account" ? styles.selected : ""} onClick={() => chooseKind("account")}>Income & expenses</button>
      <button className={kind === "trades" ? styles.selected : ""} onClick={() => chooseKind("trades")}>Share trades</button>
    </div>

    <section className={`${styles.sheet} ${styles.desktopSample}`}>
      <div className={styles.sheetHead}>
        <div><h2>{stock ? "Trades to add" : "Transactions to add"}</h2><span>{rows.length} {rows.length === 1 ? "row" : "rows"}</span></div>
        <span className={styles.requiredHint}>* Required</span>
      </div>
      {variant === "grid" && <div className={`${styles.columnHead} ${stock ? styles.tradeColumns : styles.accountColumns}`}>
        <span>#</span>{stock ? <><span>TYPE *</span><span>SYMBOL *</span><span>QUANTITY *</span><span>PRICE / SHARE * · AED</span><span>DESCRIPTION *</span><span>DATE & TIME *</span></> : <><span>TYPE *</span><span>CATEGORY *</span><span>AMOUNT * · AED</span><span>DESCRIPTION *</span><span>DATE & TIME *</span></>}
        <span />
      </div>}
      {variant === "details" && <div className={`${styles.columnHead} ${stock ? styles.tradeCompactColumns : styles.compactColumns}`}>
        <span>#</span>{stock ? <><span>TYPE *</span><span>SYMBOL *</span><span>QUANTITY *</span><span>PRICE / SHARE * · AED</span></> : <><span>TYPE *</span><span>CATEGORY *</span><span>AMOUNT * · AED</span></>}
        <span />
      </div>}
      <div className={styles.rows}>{rows.map(renderRow)}</div>
      <button className={styles.addRow} onClick={addRow}><span>+</span> Add row</button>
      <footer className={styles.footer}>
        <span className={styles.demoNote}>New rows default to {stock ? "Buy" : "Expense"} and today. Empty rows are skipped.</span>
        <div><button type="button" className={styles.cancel} onClick={() => { setRows([freshEntry(1, kind)]); setNotice(""); }}>Clear rows</button><button type="button" className={styles.save} onClick={saveSampleRows}>Save {rows.length} {rows.length === 1 ? "row" : "rows"}</button></div>
      </footer>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>

    <section className={styles.mobileSample}>
      <p className={styles.mobileNote}>At mobile width, the current single-entry form remains in place.</p>
      <div className={styles.mobileKindSwitch} role="group" aria-label="Choose sample entry type">
        <button type="button" aria-pressed={kind === "account"} onClick={() => chooseKind("account")}>Income & expenses</button>
        <button type="button" aria-pressed={kind === "trades"} onClick={() => chooseKind("trades")}>Share trades</button>
      </div>
      <div className={styles.mobileForm}>
        <div className={styles.formField}><span>Type *</span><div className={styles.segmented}>{(stock ? ["Buy", "Sell"] : ["Expense", "Income"]).map((value) => <button type="button" key={value} aria-pressed={mobileEntry.type === value} onClick={() => { updateMobileEntry("type", value); if (!stock) updateMobileEntry("category", value === "Income" ? "Salary" : "Dining"); }}>{value}</button>)}</div></div>
        {stock ? <><div className={styles.formField}><label>Symbol *</label><input value={mobileEntry.symbol} maxLength={TEXT_FIELD_MAX_LENGTH} placeholder="e.g. RELIANCE" onChange={(event) => updateMobileEntry("symbol", event.target.value)} /></div><div className={styles.formField}><label>Quantity *</label><input type="number" min="1" step="1" inputMode="numeric" value={mobileEntry.quantity} placeholder="0" onChange={(event) => updateMobileEntry("quantity", event.target.value)} /></div><div className={styles.formField}><label>Price per share * · AED</label><DecimalInput value={mobileEntry.price} placeholder="0.00" onValueChange={(value) => updateMobileEntry("price", value)} /></div></> : <><div className={styles.formField}><label>Category *</label><select value={mobileEntry.category} onChange={(event) => updateMobileEntry("category", event.target.value)}>{(mobileEntry.type === "Income" ? ["Salary", "Investment", "Other"] : ["Dining", "Groceries", "Transport"]).map((value) => <option key={value}>{value}</option>)}</select></div><div className={styles.formField}><label>Amount * · AED</label><DecimalInput value={mobileEntry.amount} placeholder="0.00" onValueChange={(value) => updateMobileEntry("amount", value)} /></div></>}
        <div className={styles.formField}><label>Description *</label><input value={mobileEntry.description} maxLength={TEXT_FIELD_MAX_LENGTH} placeholder={stock ? "Trade note" : "What was this for?"} onChange={(event) => updateMobileEntry("description", event.target.value)} /></div>
        <div className={styles.formField}><label>Date & time *</label><input type="datetime-local" value={mobileEntry.occurredAt} onChange={(event) => updateMobileEntry("occurredAt", event.target.value)} /></div>
        <button type="button" className={styles.save} onClick={() => setNotice("Sample only — nothing has been saved.")}>Save {stock ? "trade" : "transaction"}</button>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </div>
    </section>

    <nav className={styles.switcher} aria-label="UI sample options">
      <button onClick={() => changeVariant(-1)} aria-label="Previous layout">←</button>
      <span>{variants.findIndex((item) => item.id === variant) + 1} / 3 · {variants.find((item) => item.id === variant)?.name}</span>
      <button onClick={() => changeVariant(1)} aria-label="Next layout">→</button>
    </nav>
    </div>
  </main>;
}
