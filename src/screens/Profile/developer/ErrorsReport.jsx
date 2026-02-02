import React, { useEffect, useMemo, useState } from "react";
import { ref, onValue, remove } from "firebase/database"; // <-- add remove
import { db } from "../../../firebase";

import { Button } from "../../../components/ui/button";
import { ArrowLeft, Bug, Copy } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ErrorsReport = () => {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [search, setSearch] = useState("");

  const [selectedError, setSelectedError] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    const errorsRef = ref(db, "admin/appErrors");

    const unsub = onValue(errorsRef, (snap) => {
      const raw = snap.val() || {};
      const list = Object.values(raw).map((item) => ({
        ...item,
        timestamp: item.timestamp || Date.now(),
      }));

      list.sort((a, b) => b.timestamp - a.timestamp);

      setErrors(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return errors.filter((err) => {
      const ts = err.timestamp;

      const matchSearch =
        err.message?.toLowerCase().includes(search.toLowerCase()) ||
        err.stack?.toLowerCase().includes(search.toLowerCase()) ||
        err.url?.toLowerCase().includes(search.toLowerCase());

      const matchStart = startDate ? ts >= startDate.getTime() : true;
      const matchEnd = endDate ? ts <= endDate.getTime() : true;

      return matchSearch && matchStart && matchEnd;
    });
  }, [errors, search, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentPageData = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const copyError = async (err) => {
    const text = JSON.stringify(err, null, 2);
    await navigator.clipboard.writeText(text);
    alert("Copied error to clipboard!");
  };

  // ✅ Clear All Errors
  const clearAllErrors = async () => {
    const ok = window.confirm("Are you sure you want to delete ALL errors?");
    if (!ok) return;

    await remove(ref(db, "admin/appErrors")); // <-- deletes all errors
    setErrors([]);
    setSelectedError(null);
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Errors Report</h1>
          <div className="flex items-center gap-2">
            <Bug className="text-red-600" />
            <span className="text-sm text-slate-500">Live Errors</span>

            {/* ✅ Clear All Errors Button */}
            <Button variant="destructive" onClick={clearAllErrors}>
              Clear All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search error, url, stack..."
            className="border p-2 rounded"
          />

          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            placeholderText="Start Date"
            className="border p-2 rounded"
          />

          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            placeholderText="End Date"
            className="border p-2 rounded"
          />

          <Button
            variant="outline"
            onClick={() => {
              setStartDate(null);
              setEndDate(null);
              setSearch("");
              setPage(1);
            }}
          >
            Reset Filters
          </Button>
        </div>

        {/* Error Table */}
        {loading ? (
          <div className="text-center text-slate-500">Loading errors...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500">No errors found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border rounded overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">Message</th>
                    <th className="p-3 text-left">URL</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageData.map((err, idx) => (
                    <tr
                      key={idx}
                      className="border-t hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedError(err)}
                    >
                      <td className="p-3">
                        {new Date(err.timestamp).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="p-3">{err.message}</td>
                      <td className="p-3">{err.url}</td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyError(err);
                          }}
                        >
                          <Copy />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <div>
                Page {page} / {totalPages}
              </div>
              <Button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </>
        )}

        {/* Error Modal */}
        {selectedError && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Error Details</h2>
                <Button variant="ghost" onClick={() => setSelectedError(null)}>
                  Close
                </Button>
              </div>

              <pre className="whitespace-pre-wrap text-sm bg-slate-100 p-3 rounded">
                {JSON.stringify(selectedError, null, 2)}
              </pre>

              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => copyError(selectedError)}>
                  Copy Error
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorsReport;