import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "../../firebase";
import { ref, get, set, onValue } from "firebase/database";
import { toSafeKey } from "../../lib/safekey";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "../../components/ui/command";
import { cn } from "../../lib/utils";

export default function AddPayment() {
  const navigate = useNavigate();

  const [date, setDate] = useState(() => {
    const saved = localStorage.getItem("lastPaymentDate");
    return saved ? new Date(saved) : new Date();
  });

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [fromType, setFromType] = useState("");
  const [toType, setToType] = useState("");

  const [fromEntity, setFromEntity] = useState(null);
  const [toEntity, setToEntity] = useState(null);

  const [parties, setParties] = useState([]);
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  /* ---------------- LOAD ENTITIES ---------------- */
  useEffect(() => {
    const loadParties = async () => {
      const snap = await get(ref(db, "parties"));
      if (!snap.exists()) return;

      const list = [];
      Object.entries(snap.val()).forEach(([id, data]) => {
        if (!data?.name) return;
        list.push({
          id,
          parentKey: id,
          name: data.name,
          city: data.city || "",
        });
      });
      setParties(list);
    };

    const loadBanks = async () => {
      const snap = await get(ref(db, "banks"));
      if (!snap.exists()) return;

      const list = [];
      Object.entries(snap.val()).forEach(([id, data]) => {
        if (!data?.bankName) return;
        list.push({
          id,
          parentKey: id,
          name: data.bankName,
        });
      });
      setBanks(list);
    };

    const loadAccounts = async () => {
      const snap = await get(ref(db, "accounts"));
      if (!snap.exists()) return;

      const list = [];
      Object.entries(snap.val()).forEach(([id, data]) => {
        if (!data?.name) return;
        list.push({
          id,
          parentKey: id,
          name: data.name,
          balance: data.balance || 0,
        });
      });
      setAccounts(list);
    };

    loadParties();
    loadBanks();
    loadAccounts();
  }, []);

  const getListByType = (type) => {
    if (type === "party") return parties;
    if (type === "bank") return banks;
    if (type === "account") return accounts;
    return [];

    if (
      fromType === toType &&
      fromEntity.parentKey === toEntity.parentKey
    ) {
      alert("From and To cannot be the same");
      return;
    }
  };

  const renderDropdown = (
    type,
    value,
    setValue,
    open,
    setOpen,
    search,
    setSearch
  ) => (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {value?.name || "Select"}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[260px]">
        <Command>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
            {getListByType(type)
              .filter((e) =>
                (e.name || "").toLowerCase().includes(search.toLowerCase())
              )
              .map((e) => (
                <CommandItem
                  key={`${type}-${e.id}`} // unique key
                  onSelect={() => {
                    setValue(e);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.id === e.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {type === "party" && `${e.name}${e.city ? ` (${e.city})` : ""}`}
                  {type === "bank" && `${e.name}`}
                  {type === "account" && `${e.name}`}
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const getLocalDateKey = (date) => {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fromType || !toType || !fromEntity || !toEntity || !amount) {
      alert("Fill all fields");
      return;
    }

    if (!fromEntity || !toEntity) return;

    const fromKey = toSafeKey(fromEntity.name);
    const toKey = toSafeKey(toEntity.name);

    const amt = Number(amount);
    const dateKey = getLocalDateKey(date);
    const txnId = Date.now().toString();
    const createdAt = Date.now();

    const nodeMap = {
      party: "parties",
      bank: "banks",
      account: "accounts",
    };

    const payload = {
      txnId,
      fromType,
      fromName: fromEntity.name,
      toType,
      toName: toEntity.name,
      amount: amt,
      note: note || "-",
      date: dateKey,
      createdAt,
    };

    const updateBalance = async (type, entity, delta) => {
      const balRef = ref(db, `${nodeMap[type]}/${entity.parentKey}/balance`);
      const snap = await get(balRef);
      const current = snap.exists() ? Number(snap.val()) : 0;
      await set(balRef, current + delta);
    };

    const saveEntry = async (type, entity) => {
      await set(
        ref(db, `${nodeMap[type]}/${entity.parentKey}/entries/${dateKey}/${txnId}`),
        payload
      );
    };

    const savePaymentNode = async () => {
      // From side
      await set(
        ref(db, `payments/${fromType}/${fromKey}/${dateKey}/${txnId}`),
        {
          txnId,
          fromType,
          fromName: fromEntity.name,
          toType,
          toName: toEntity.name,
          amount: amt,
          note: note || "-",
          date: dateKey,
          createdAt,
        }
      );

      // To side
      await set(
        ref(db, `payments/${toType}/${toKey}/${dateKey}/${txnId}`),
        {
          txnId,
          fromType,
          fromName: fromEntity.name,
          toType,
          toName: toEntity.name,
          amount: amt,
          note: note || "-",
          date: dateKey,
          createdAt,
        }
      );
    };

    try {
      await updateBalance(fromType, fromEntity, -amt);
      await updateBalance(toType, toEntity, amt);

      await saveEntry(fromType, fromEntity);
      await saveEntry(toType, toEntity);

      await savePaymentNode();

      alert("Transaction Added Successfully");

      // reset form (optional but recommended)
      setAmount("");
      setNote("");
      
    } catch (err) {
      console.error(err);
      alert("Error saving transaction");
    }
  };

onValue(ref(db, "/"), (snap) => {
  console.log(snap.val());
});

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen flex justify-center px-4 pt-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/payment")}>
            <ArrowLeft />
          </Button>
          <h1 className="mx-auto text-xl font-semibold">Record Payment</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Date<br /></label>
                  <DatePicker
                    selected={date}
                    onChange={(d) => {
                      setDate(d);
                      localStorage.setItem("lastPaymentDate", d.toISOString());
                    }}
                    className="w-full border rounded p-2"
                    dateFormat="dd-MM-yyyy"
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label>Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded p-2"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>From Type</label>
                  <select
                    className="w-full border rounded p-2"
                    value={fromType}
                    onChange={(e) => {
                      setFromType(e.target.value);
                      setFromEntity(null);
                    }}
                  >
                    <option value="">Select</option>
                    <option value="party">Party</option>
                    <option value="bank">Bank</option>
                    <option value="account">Account</option>
                  </select>
                </div>
                <div>
                  <label>From</label>
                  {fromType &&
                    renderDropdown(
                      fromType,
                      fromEntity,
                      setFromEntity,
                      fromOpen,
                      setFromOpen,
                      fromSearch,
                      setFromSearch
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>To Type</label>
                  <select
                    className="w-full border rounded p-2"
                    value={toType}
                    onChange={(e) => {
                      setToType(e.target.value);
                      setToEntity(null);
                    }}
                  >
                    <option value="">Select</option>
                    <option value="party">Party</option>
                    <option value="bank">Bank</option>
                    <option value="account">Account</option>
                  </select>
                </div>
                <div>
                  <label>To</label>
                  {toType &&
                    renderDropdown(
                      toType,
                      toEntity,
                      setToEntity,
                      toOpen,
                      setToOpen,
                      toSearch,
                      setToSearch
                    )}
                </div>
              </div>

              <div>
                <label>Notes</label>
                <textarea
                  className="w-full border rounded p-2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <Button className="w-full mt-4">Save Transaction</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
