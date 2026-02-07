//C:\Users\omkar\Desktop\client\src\screens\Bank\Bankdetails.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { ref, onValue, off, set } from "firebase/database";
import { Button } from "../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import DatePicker from "react-datepicker";
import { toSafeKey } from "../../lib/safekey";

import "react-datepicker/dist/react-datepicker.css";

const BankLedgerScreen = () => {
  const { bankId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [ledgerData, setLedgerData] = useState({
    bankName: "",
    transactions: [],
    balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const itemsPerPage = 20;
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  useEffect(() => {
    setLoading(true);
    const bankRef = ref(db, `banks/${bankId}`);
    const paymentsRef = ref(db, "payments");

    const handleUpdate = async () => {
      try {
        const bankSnap = await new Promise((resolve) =>
          onValue(bankRef, resolve, { onlyOnce: true })
        );
        const bank = bankSnap.val();
        if (!bank) return;

        const bankName = bank.bankName || "Bank";
        const openingBalance = round2(Number(bank.openingBalance || 0));
        const createdAt = bank.createdAt;

        let transactions = [];
        const usedKeys = new Set();

        // Opening balance row
        transactions.push({
          id: "opening",
          type: "Opening Balance",
          date: createdAt,
          source: "-",
          notes: "Opening balance",
          amount: openingBalance,
          createdAt: Number(createdAt) || Date.now(),
          isOpening: true, // Flag to identify opening row
        });

        // EXPENSES
        await new Promise((resolve) =>
          onValue(ref(db, `expenses/bank/${toSafeKey(bankName)}`), (snap) => {
            const data = snap.val() || {};
            Object.values(data).forEach((e) => {
              if (!e.amount || !e.date) return;
              const key = `exp-${e.createdAt}`;
              if (usedKeys.has(key)) return;
              usedKeys.add(key);
              transactions.push({
                id: e.createdAt,
                type: "Expense",
                date: e.date,
                source: "-",
                notes: e.expenseFor || "-",
                amount: -round2(Number(e.amount)),
                createdAt: Number(e.createdAt) || Date.now(),
              });
            });
            resolve();
          }, { onlyOnce: true })
        );

        // PAYMENTS
        await new Promise((resolve) =>
          onValue(paymentsRef, (snap) => {
            const data = snap.val() || {};
            Object.values(data).forEach((lvl1) => {
              Object.values(lvl1).forEach((lvl2) => {
                Object.values(lvl2).forEach((lvl3) => {
                  Object.values(lvl3).forEach((p) => {
                    if (!p.amount || !p.date) return;
                    const key = `pay-${p.createdAt}`;
                    if (usedKeys.has(key)) return;
                    usedKeys.add(key);

                    let amount = round2(Number(p.amount));
                    let source = "-";

                    if (p.fromName === bankName) {
                      amount = -amount;
                      source = `to ${p.toName}`;
                    } else if (p.toName === bankName) {
                      source = `from ${p.fromName}`;
                    } else return;

                    transactions.push({
                      id: p.createdAt,
                      type: "Payment",
                      date: p.date,
                      source,
                      notes: p.note || "-",
                      amount,
                      createdAt: Number(p.createdAt) || Date.now(),
                    });
                  });
                });
              });
            });
            resolve();
          }, { onlyOnce: true })
        );

        // TRANSFERS
        await new Promise((resolve) =>
          onValue(ref(db, `transfers/bank/${toSafeKey(bankName)}`), (snap) => {
            const data = snap.val() || {};
            Object.entries(data).forEach(([date, dateNode]) => {
              Object.values(dateNode).forEach((t) => {
                if (!t.amount || t.toType !== "bank" || t.toName !== bankName) return;
                const key = `tr-${t.createdAt}`;
                if (usedKeys.has(key)) return;
                usedKeys.add(key);
                transactions.push({
                  id: t.createdAt,
                  type: "Transfer",
                  date: t.date || date,
                  source: t.from || "-",
                  notes: t.note || "-",
                  amount: round2(Number(t.amount)),
                  createdAt: Number(t.createdAt) || Date.now(),
                });
              });
            });
            resolve();
          }, { onlyOnce: true })
        );

        // FILTER BY DATE
        let filteredTxns = transactions;
        if (fromDate) filteredTxns = filteredTxns.filter((t) => new Date(t.date) >= fromDate);
        if (toDate) filteredTxns = filteredTxns.filter((t) => new Date(t.date) <= toDate);

        // SORT & running balance
        filteredTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        const finalTxns = filteredTxns.map((t, i) => {
          runningBalance = i === 0 ? round2(t.amount) : round2(runningBalance + t.amount);
          return { ...t, runningBalance };
        });

        setLedgerData({ bankName, transactions: finalTxns, balance: runningBalance });
        set(ref(db, `banks/${bankId}/balance`), runningBalance);

        setCurrentPage(1);
      } catch (err) {
        console.error("Ledger error:", err);
      } finally {
        setLoading(false);
      }
    };

    handleUpdate();
    return () => off(paymentsRef, "value");
  }, [bankId, fromDate, toDate]);

  const totalPages = useMemo(
    () => Math.ceil(ledgerData.transactions.length / itemsPerPage),
    [ledgerData.transactions.length]
  );

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return ledgerData.transactions.slice(start, start + itemsPerPage);
  }, [ledgerData.transactions, currentPage]);

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex flex-col max-w-7xl mx-auto mt-10 p-4 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-2 relative print-hide">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-9 w-9 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <DatePicker
            selected={fromDate}
            onChange={(date) => setFromDate(date)}
            placeholderText="From"
            className="border border-gray-400 rounded px-2 py-1 text-sm"
            isClearable
          />
          <DatePicker
            selected={toDate}
            onChange={(date) => setToDate(date)}
            placeholderText="To"
            className="border border-gray-400 rounded px-2 py-1 text-sm"
            isClearable
          />
        </div>

        <Button onClick={handlePrint} className="absolute right-0 top-1/2 -translate-y-1/2 h-9 text-sm">
          Print Ledger
        </Button>
      </div>

      {/* PRINT AREA */}
      <div ref={printRef} className="print-area">
        <h1 className="text-3xl font-semibold text-center mb-4">{ledgerData.bankName}</h1>

        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 text-center">
            <thead>
              <tr className="bg-gray-100 text-xl">
                <th className="border p-3">Date</th>
                <th className="border p-3">Type</th>
                <th className="border p-3">Source</th>
                <th className="border p-3">Notes</th>
                <th className="border p-3">Amount</th>
                <th className="border p-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6">No transactions found</td>
                </tr>
              ) : (
                paginatedTransactions.map((t, idx) => {
                  if (t.isOpening && currentPage !== 1) return null;
                  return (
                    <tr key={t.id || idx} className={t.isOpening ? "bg-gray-200 text-gray-700 font-semibold" : "hover:bg-gray-50"}>
                      <td className="border p-3">{formatDate(t.date)}</td>
                      <td className="border p-3">{t.type}</td>
                      <td className="border p-3">{t.source}</td>
                      <td className="border p-3">{t.notes}</td>
                      <td className={`border p-3 font-semibold ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {t.amount.toFixed(2)}
                      </td>
                      <td className={`border p-3 font-semibold ${t.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {t.runningBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Current balance */}
              <tr className="bg-gray-100 border-t-2">
                <td className="border p-3 text-right"></td>
                <td colSpan={4} className="border p-3 text-end font-semibold text-black">
                  Current Balance
                </td>
                <td className="border p-3 font-bold text-center">
                  <span className={`${ledgerData.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {ledgerData.balance.toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-center items-center gap-2 shadow-md z-50 print-hide">
        <Button
          size="sm"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </Button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <Button
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </Button>
      </div>

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: fixed;
            inset: 0;
            width: 100%;
            padding: 24px;
            box-shadow: none !important;
            border: none !important;
          }
          .print-hide {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default BankLedgerScreen;
