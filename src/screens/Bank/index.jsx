//C:\Users\omkar\Desktop\client\src\screens\Bank\index.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase";

import { Button } from "../../components/ui/button";
import { ArrowLeft, Plus, Landmark } from "lucide-react";

export default function BanksLedger() {
  const navigate = useNavigate();

  const [banks, setBanks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---------- Fetch Banks ---------- */
  useEffect(() => {
    const banksRef = ref(db, "banks");

    const unsub = onValue(banksRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, bank]) => ({
        bankId: id,
        bankName: bank.bankName || "-",
        balance: Number(bank.balance || 0),
      }));
      setBanks(list);
    });

    return () => unsub();
  }, []);

  /* ---------- Helpers ---------- */
  const format2 = (n) => Number(n).toFixed(2);

  /* ---------- Search ---------- */
  const filteredBanks = banks.filter((b) =>
    b.bankName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ---------- Net Balance ---------- */
  const netBalance = filteredBanks.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="flex flex-col max-w-7xl mx-auto mt-10 p-4 space-y-6">
      {/* HEADER */}
      <div className="relative border-b pb-2 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="absolute left-0 h-9 w-9 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <h1 className="text-xl font-semibold">Banks</h1>

        <Button
          onClick={() => navigate("/banks/add-bank")}
          className="absolute right-0 h-9 text-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Bank
        </Button>
      </div>

      {/* SEARCH + NET BALANCE */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <input
          type="text"
          placeholder="Search bank..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded px-3 py-2 w-full sm:w-72"
        />

        <div className="text-lg font-semibold">
          Net Balance:{" "}
          <span
            className={netBalance >= 0 ? "text-green-600" : "text-red-600"}
          >
            {format2(netBalance)}
          </span>
        </div>
      </div>

      {/* BANK CARDS */}
      {filteredBanks.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
          No banks found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBanks.map((bank) => (
            <div
              key={bank.bankId}
              onClick={() =>
                navigate(`/banks/${bank.bankId}`, { state: { bank } })
              }
              className="cursor-pointer rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:shadow-md hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10">
                  <Landmark className="h-6 w-6 text-primary" />
                </div>

                <div className="flex flex-col">
                  <h3 className="text-lg font-semibold">
                    {bank.bankName}
                  </h3>
                  <span
                    className={`text-sm font-medium ${
                      bank.balance >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {format2(bank.balance)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
