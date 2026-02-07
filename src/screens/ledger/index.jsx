import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase";

import { Button } from "../../components/ui/button";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";

export default function Ledger() {
  const navigate = useNavigate();

  const [parties, setParties] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "partyName",
    direction: "asc", // ✅ A–Z by default
  });

  // ---------- PAGINATION ----------
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = sessionStorage.getItem("ledgerPage");
    return savedPage ? Number(savedPage) : 1;
    });

  const rowsPerPage = 15;

  useEffect(() => {
    sessionStorage.setItem("ledgerPage", currentPage);
  }, [currentPage]);

  /* ---------- Fetch Parties ---------- */
  useEffect(() => {
    const partiesRef = ref(db, "parties");
    const salesRef = ref(db, "sales");
    const paymentsRef = ref(db, "payments");

    let partiesData = {};
    let salesData = {};
    let paymentsData = {};

    const rebuildSummary = () => {
      const list = Object.entries(partiesData).map(([id, party]) => {
        const partyName = party.name || "-";
        let balance = Number(party.openingBalance || 0);

        /* ---- SALES ---- */
        Object.values(salesData).forEach(group => {
          Object.values(group).forEach(inv => {
            if (inv.partyId !== id) return;

            const total = (inv.items || []).reduce(
              (s, i) => s + Number(i.total || 0),
              0
            );

            balance += total;
          });
        });

        /* ---- PAYMENTS ---- */
        Object.values(paymentsData).forEach(l1 => {
          Object.values(l1).forEach(l2 => {
            Object.values(l2).forEach(l3 => {
              Object.values(l3).forEach(p => {
                if (!p?.txnId) return;

                if (p.fromName === partyName)
                  balance -= Number(p.amount || 0);

                if (p.toName === partyName)
                  balance += Number(p.amount || 0);
              });
            });
          });
        });

        return {
          partyId: id,
          partyName,
          city: party.city || "-",
          balance,
        };
      });

      setParties(list);
    };

    const u1 = onValue(partiesRef, snap => {
      partiesData = snap.val() || {};
      rebuildSummary();
    });

    const u2 = onValue(salesRef, snap => {
      salesData = snap.val() || {};
      rebuildSummary();
    });

    const u3 = onValue(paymentsRef, snap => {
      paymentsData = snap.val() || {};
      rebuildSummary();
    });

    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  /* ---------- Helpers ---------- */
  const format2 = (num) => Number(num).toFixed(2);

  /* ---------- Search ---------- */
  const filteredParties = parties.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true; // show all if search is empty

    return (
      p.partyName.toLowerCase().startsWith(q) || 
      p.city.toLowerCase().startsWith(q)
    );
  });

  /* ---------- Sorting ---------- */
  const sortedParties = [...filteredParties].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="inline h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="inline h-4 w-4 ml-1" />
    );
  };

  // ---------- PAGINATION SLICE ----------
  const totalPages = Math.ceil(sortedParties.length / rowsPerPage);
  const paginatedParties = sortedParties.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Total money yet to collect (sum of positive balances)
  const totalReceivable = parties
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  // Total advance (sum of negative balances)
  const totalAdvance = parties
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + p.balance, 0);

  // Net Receivable
  const netReceivable = totalReceivable + totalAdvance;

  /* ---------- UI ---------- */
  return (
    <div className="flex flex-col max-w-7xl mx-auto mt-10 p-4 space-y-4">
      {/* Header */}
      <div className="relative border-b pb-2 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <h1 className="text-xl font-semibold text-center">
          Party Ledger Summary
        </h1>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-lg font-semibold">
          Net Receivable:{" "}
          <span className={`${netReceivable >= 0 ? "text-red-600" : "text-green-600"}`}>
            {format2(netReceivable)}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex justify-center">
        <input
          type="text"
          placeholder="Search party or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-400 rounded px-3 py-2 text-base w-72"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto border border-gray-300 text-center">
          <thead>
            <tr className="bg-gray-100 text-base">
              <th
                className="border p-3 cursor-pointer"
                onClick={() => handleSort("partyName")}
              >
                Party Name {renderSortIcon("partyName")}
              </th>

              <th className="border p-3">Place</th>

              <th
                className="border p-3 cursor-pointer"
                onClick={() => handleSort("balance")}
              >
                Current Balance {renderSortIcon("balance")}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedParties.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6">
                  No parties found.
                </td>
              </tr>
            ) : (
              paginatedParties.map((party) => (
                <tr
                  key={party.partyId}
                  className="hover:bg-gray-50 cursor-pointer text-base"
                  onClick={() =>
                    navigate(`/ledger/${party.partyId}`, { state: { party } })
                  }
                >
                  <td className="border p-4 font-medium">{party.partyName}</td>
                  <td className="border p-4">{party.city}</td>
                  <td
                    className={`border p-2 font-semibold ${
                      Number(party.balance || 0) >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {Number(party.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Prev
            </Button>

            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
