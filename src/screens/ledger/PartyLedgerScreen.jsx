import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { ref, onValue, off, set } from "firebase/database";
import { Button } from "../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PartyLedgerScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [ledgerData, setLedgerData] = useState({
    partyName: "",
    transactions: [],
    balance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const ITEMS_PER_PAGE = 20;
  const round2 = (n) =>
    Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  /* ---------------- FETCH LEDGER ---------------- */
  useEffect(() => {
    setLoading(true);

    const partyRef = ref(db, `parties/${id}`);
    const salesRef = ref(db, "sales");
    const paymentsRef = ref(db, "payments");

    const buildLedger = async () => {
      try {
        const partySnap = await new Promise((resolve) =>
          onValue(partyRef, resolve, { onlyOnce: true })
        );

        const party = partySnap.val();
        if (!party) return;

        const partyName = party.name;
        const openingBalance = round2(Number(party.openingBalance || 0));
        const createdAt = party.createdAt;

        const transactions = [];
        const usedKeys = new Set();

        /* Opening balance */
        transactions.push({
          type: "Old Balance",
          date: createdAt,
          invoice: "-",
          source: "-",
          notes: "Opening balance",
          amount: openingBalance,
        });

        /* Sales */
        await new Promise((resolve) =>
          onValue(
            salesRef,
            (snap) => {
              const sales = snap.val() || {};
              Object.values(sales).forEach((group) => {
                Object.values(group).forEach((inv) => {
                  if (inv.partyId !== id) return;

                  const key = `sale-${inv.invoiceNumber}`;
                  if (usedKeys.has(key)) return;
                  usedKeys.add(key);

                  const total = round2(
                    inv.items?.reduce(
                      (s, i) => s + Number(i.total || 0),
                      0
                    )
                  );

                  const categories = Array.from(
                    new Set(
                      (inv.items || [])
                        .map((i) => i.category)
                        .filter(Boolean)
                    )
                  ).join(", ");

                  transactions.push({
                    type: "Sale",
                    date: inv.createdAt,
                    invoice: inv.invoiceNumber,
                    source: "-",
                    notes: categories || "-", 
                    amount: total,
                  });
                });
              });
              resolve();
            },
            { onlyOnce: true }
          )
        );

        /* Payments */
        await new Promise((resolve) =>
          onValue(
            paymentsRef,
            (snap) => {
              const payments = snap.val() || {};
              Object.values(payments).forEach((l1) => {
                Object.values(l1).forEach((l2) => {
                  Object.values(l2).forEach((l3) => {
                    Object.values(l3).forEach((p) => {
                      if (!p?.txnId) return;

                      const key = `payment-${p.txnId}`;
                      if (usedKeys.has(key)) return;
                      usedKeys.add(key);

                      if (
                        p.fromName !== partyName &&
                        p.toName !== partyName
                      )
                        return;

                      let amount = round2(Number(p.amount || 0));
                      let source = "-";

                      if (p.fromName === partyName) {
                        amount = -amount;
                        source = `to ${p.toName}`;
                      }
                      if (p.toName === partyName) {
                        source = `from ${p.fromName}`;
                      }

                      transactions.push({
                        type: "Payment",
                        date: p.date || p.createdAt,
                        invoice: "-",
                        source,
                        notes: p.note?.trim() ? p.note : "-",
                        amount,
                      });
                    });
                  });
                });
              });
              resolve();
            },
            { onlyOnce: true }
          )
        );

      /* Expenses (GLOBAL NODE ONLY) */
      await new Promise((resolve) =>
        onValue(
          ref(db, "expenses/party"),
          (snap) => {

            const expenses = snap.val() || {};

            Object.values(expenses).forEach((partyGroup) => {
              Object.values(partyGroup).forEach((exp) => {

                // Match this ledger's party
                if (exp.entity !== partyName) return;

                const key = `expense-${exp.createdAt}`;
                if (usedKeys.has(key)) return;
                usedKeys.add(key);

                transactions.push({
                  type: "Expense",
                  date: exp.date || exp.createdAt,
                  invoice: "-",
                  source: "-",
                  notes: exp.expenseFor || "-",
                  amount: -round2(Number(exp.amount || 0)),
                });

              });
            });

            resolve();
          },
          { onlyOnce: true }
        )
      );

        /* Sort by date */
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        /* Running balance */
        let runningBalance = 0;
        const finalTxns = transactions.map((t, i) => {
          runningBalance =
            i === 0
              ? round2(t.amount)
              : round2(runningBalance + t.amount);
          return { ...t, runningBalance };
        });

        setLedgerData({
          partyName,
          transactions: finalTxns,
          balance: runningBalance,
        });

        set(ref(db, `parties/${id}/balance`), runningBalance);
        setCurrentPage(Math.ceil(finalTxns.length / ITEMS_PER_PAGE) || 1);
      } catch (err) {
        console.error("Ledger error:", err);
      } finally {
        setLoading(false);
      }
    };

    buildLedger();

    const s = onValue(salesRef, buildLedger);
    const p = onValue(paymentsRef, buildLedger);

    return () => {
      off(salesRef, "value", s);
      off(paymentsRef, "value", p);
    };
  }, [id]);

  /* ---------------- DATE FILTER ---------------- */
  const filteredTransactions = useMemo(() => {
    return ledgerData.transactions.filter((t) => {
      const d = new Date(t.date);

      if (fromDate) {
        const f = new Date(fromDate);
        f.setHours(0, 0, 0, 0);
        if (d < f) return false;
      }

      if (toDate) {
        const tDate = new Date(toDate);
        tDate.setHours(23, 59, 59, 999);
        if (d > tDate) return false;
      }

      return true;
    });
  }, [ledgerData.transactions, fromDate, toDate]);

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.ceil(
    filteredTransactions.length / ITEMS_PER_PAGE
  );

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* ---------------- HELPERS ---------------- */
  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${date.getFullYear()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        Loading ledger...
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-7xl mx-auto mt-10 p-4 space-y-4">
      {/* HEADER (NOT PRINTED) */}
      <div className="flex items-center justify-between border-b pb-2 print-hide">
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
            onChange={setFromDate}
            placeholderText="From"
            className="border rounded px-2 py-1 text-sm"
            isClearable
          />

          <DatePicker
            selected={toDate}
            onChange={setToDate}
            placeholderText="To"
            className="border rounded px-2 py-1 text-sm"
            isClearable
          />
        </div>

        <Button onClick={handlePrint} className="h-9 text-sm">
          Print Ledger
        </Button>
      </div>

      {/* PRINT AREA */}
      <div
        ref={printRef}
        className="print-area bg-white border shadow-md p-6"
      >
        <h1 className="text-3xl font-semibold text-center mb-4">
          {ledgerData.partyName}
        </h1>

        <table className="w-full border border-gray-300 text-center">
          <thead>
            <tr className="bg-gray-100 text-lg">
              <th className="border p-3">Date</th>
              <th className="border p-3">Type</th>
              <th className="border p-3">Invoice</th>
              <th className="border p-3">Source</th>
              <th className="border p-3">Notes</th>
              <th className="border p-3">Amount</th>
              <th className="border p-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((t, i) => (
              <tr key={i}>
                <td className="border p-3">{formatDate(t.date)}</td>
                <td className="border p-3">{t.type}</td>
                <td className="border p-3">
                    {t.invoice !== "-" ? (
                      <button
                        className="text-blue-600 underline hover:text-blue-800"
                        onClick={() =>
                          navigate("/sales/view-invoice", {
                            state: {
                              invoiceNumber: t.invoice,
                            },
                          })
                        }
                      >
                        {t.invoice}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                <td className="border p-3">{t.source}</td>
                <td className="border p-3">{t.notes}</td>

                <td
                  className={`border p-3 font-semibold ${
                    t.amount < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {Math.abs(t.amount).toFixed(2)}
                </td>

                <td
                  className={`border p-3 font-semibold ${
                    t.runningBalance < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {t.runningBalance.toFixed(2)}
                </td>

              </tr>
            ))}

            <tr className="bg-gray-100 font-bold">
              <td colSpan={6} className="border p-3 text-right">
                Current Balance
              </td>
              <td
                className={`border p-3 font-bold ${
                  ledgerData.balance < 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {ledgerData.balance.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PAGINATION (NOT PRINTED) */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-center gap-2 print-hide">
          <Button
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* PRINT STYLES (SAME AS ViewInvoice) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            margin: 0;
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

export default PartyLedgerScreen;
