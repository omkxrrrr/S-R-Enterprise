import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronsUpDown, Check, Trash2 } from "lucide-react";
import { db } from "../../firebase";
import { ref, set, runTransaction, onValue } from "firebase/database";
import { cn } from "../../lib/utils";
import { toast } from "react-toastify";
import { useRef } from "react";


// Format ISO with date & time
const formatToISO = (dateObj) => {
  if (!dateObj) return "";
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const min = String(dateObj.getMinutes()).padStart(2, "0");
  const ss = String(dateObj.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
};

// Round to 2 decimals safely
const round2 = (num) =>
  Math.round((Number(num) + Number.EPSILON) * 100) / 100;
const formatPrice = (value) => {
  const v = Number(value || 0);
  return v !== 0 && v < 0.01 ? v.toFixed(4) : v.toFixed(2);
};

const calculateSubtotalFromItems = (items = []) =>
  round2(items.reduce((sum, i) => sum + Number(i.total || 0), 0));

const getDateKeyFromISO = (iso) => {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const SalesInvoice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceToEdit = location.state;

  const boxInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const addButtonRef = useRef(null);

  // Stocks, Parties, Warehouses
  const [stocks, setStocks] = useState([]);
  const [parties, setParties] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Selected IDs
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);

  // Popover open states
  const [partyOpen, setPartyOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Search text for filtering
  const [partySearchText, setPartySearchText] = useState("");
  const [warehouseSearchText, setWarehouseSearchText] = useState("");
  const [categorySearchText, setCategorySearchText] = useState("");
  const [productSearchText, setProductSearchText] = useState("");

  // Item input fields
  const [box, setBox] = useState("");
  const [piecesPerBox, setPiecesPerBox] = useState("");
  const [pricePerItem, setPricePerItem] = useState("");
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);

  const calculateItemTotal = (item) => {
    const box = Number(item.box) || 0;
    const pieces = Number(item.piecesPerBox) || 0;
    const price = Number(item.pricePerItem) || 0;

    if (item.category === "Discount") return -price;
    if (item.category === "GST") return price;
    if (item.box === "-" || item.piecesPerBox === "-") return price;

    return round2(box * pieces * price);
  };

  useEffect(() => {
    const total = items.reduce((sum, i) => sum + calculateItemTotal(i), 0);
    setSubtotal(round2(total || 0));
  }, [items]);
  
  const [createdAt, setCreatedAt] = useState(() => {
    const saved = localStorage.getItem("lastSalesDate");
    return saved ? new Date(saved) : new Date();
  });

  const [stockWarning, setStockWarning] = useState("");

  // TEMP STOCK (session-only)
  const [tempStock, setTempStock] = useState({});

  // Derived names for display
  const selectedPartyName =
    parties.find((p) => p.id === selectedPartyId)?.name || "";
  const selectedWarehouseName =
    warehouses.find((w) => w.id === selectedWarehouseId)?.name || "";

  // Fetch stocks, parties, warehouses live
  useEffect(() => {
    const stocksRef = ref(db, "stocks");
    onValue(stocksRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return setStocks([]);
      const stockItems = [];
      Object.entries(data).forEach(([dateKey, dateGroup]) => {
        Object.entries(dateGroup).forEach(([id, stock]) => {
          stockItems.push({ ...stock, id, dateKey });
        });
      });
      setStocks(stockItems);

      // initialize temp stock
      const temp = {};
      stockItems.forEach((s) => {
        const totalPieces =
          (Number(s.boxes) || 0) * (Number(s.piecesPerBox) || 1) +
          (Number(s.pieces) || 0);

        temp[s.id] = {
          availablePieces: totalPieces,
          piecesPerBox: Number(s.piecesPerBox) || 1,
        };
      });

      setTempStock(prev => Object.keys(prev).length ? prev : temp);
    });

    const partiesRef = ref(db, "parties");
    onValue(partiesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return setParties([]);
      setParties(
        Object.entries(data).map(([id, details]) => ({ id, ...details }))
      );
    });

    const warehousesRef = ref(db, "warehouse");
    onValue(warehousesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return setWarehouses([]);
      setWarehouses(
        Object.entries(data).map(([id, details]) => ({ id, ...details }))
      );
    });
  }, []);

  // --- Add default discount and GST items in the table ---
  useEffect(() => {
    const discountItem = {
      category: "Discount",
      productName: "Discount",
      box: "-", 
      piecesPerBox: "-", 
      pricePerItem: 0,
      total: 0,
      isEditable: true,
    };
    const gstItem = {
      category: "GST",
      productName: "GST",
      box: "-", 
      piecesPerBox: "-", 
      pricePerItem: 0,
      total: 0,
      isEditable: true,
    };

    setItems(prevItems => {
      // Add only if not already present
      const hasDiscount = prevItems.some(i => i.category === "Discount");
      const hasGst = prevItems.some(i => i.category === "GST");

      const newItems = [...prevItems];
      if (!hasDiscount) newItems.push(discountItem);
      if (!hasGst) newItems.push(gstItem);

      return newItems;
    });
  }, []);

  // Pre-fill invoice if editing
  useEffect(() => {
    if (invoiceToEdit) {
      // 1️⃣ Set basic fields
      setSelectedPartyId(invoiceToEdit.partyId || "");
      setItems(invoiceToEdit.items || []);
      setSubtotal(
        calculateSubtotalFromItems(invoiceToEdit.items || [])
      );      setCreatedAt(
        invoiceToEdit.createdAt ? new Date(invoiceToEdit.createdAt) : new Date()
      );
      setSelectedWarehouseId(invoiceToEdit.warehouseId || "");
      if (invoiceToEdit.items?.[0]?.category)
        setSelectedCategory(invoiceToEdit.items[0].category);

      // 2️⃣ Adjust temp stock for already-added items (VERY IMPORTANT)
      if (invoiceToEdit.items?.length) {
        setTempStock(prev => {
          const updated = { ...prev };

          invoiceToEdit.items.forEach(item => {
            if (updated[item.stockId]) {
              const usedPieces =
                Number(item.box) * Number(item.piecesPerBox);

              updated[item.stockId].availablePieces -= usedPieces;
            }
          });

          return updated;
        });
      }
    }
  }, [invoiceToEdit]);

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setBox(1);
    setPiecesPerBox(Number(stock.piecesPerBox) || 0);
    setPricePerItem(Number(stock.pricePerPiece) || 0);
    setProductOpen(false);
    setStockWarning("");

    // ✅ Focus the Box input
    setTimeout(() => {
    boxInputRef.current?.focus();
    boxInputRef.current?.select(); // optional: select existing value
    }, 0);
  };

  const handleAddItem = () => {
    if (!selectedPartyId)
      return alert("Please select a party before adding items.");
    if (!selectedWarehouseId)
      return alert("Please select a warehouse before adding items.");
    if (!selectedStock || !box || !piecesPerBox || pricePerItem === "")
      return alert("Please fill all fields.");

    const stockId = selectedStock.id;
    const temp = tempStock[stockId];

    if (!temp) {
      setStockWarning("Stock not available.");
      return;
    }

    const desiredPieces = Number(box) * Number(piecesPerBox);

    // ✅ BOX-BASED CHECK (NOT PIECES MESSAGE)
    const availableBoxes = Math.floor(
      temp.availablePieces / Number(piecesPerBox || 1)
    );

    if (Number(box) > availableBoxes) {
      setStockWarning(`Cannot add! Only ${availableBoxes} boxes available.`);
      return;
    }

    const totalItem = round2(desiredPieces * Number(pricePerItem));

    const existingIndex = items.findIndex(
      (item) =>
        item.productName === selectedStock.productName &&
        item.piecesPerBox === Number(piecesPerBox) &&
        item.pricePerItem === Number(pricePerItem)
    );

    // ✅ TEMP STOCK DEDUCTION (CORE FIX)
    setTempStock((prev) => ({
      ...prev,
      [stockId]: {
        ...prev[stockId],
        availablePieces: prev[stockId].availablePieces - desiredPieces,
      },
    }));

    if (existingIndex !== -1) {
      const updatedItems = items.map((item, idx) => {
        if (idx === existingIndex) {
          const newBoxCount = item.box + Number(box);
          return {
            ...item,
            box: newBoxCount,
            total: round2(
              newBoxCount * item.piecesPerBox * item.pricePerItem
            ),
          };
        }
        return item;
      });

      setItems(updatedItems);
      setSubtotal((prev) => round2(prev + totalItem));
    } else {
      const newItem = {
        partyId: selectedPartyId,
        warehouseId: selectedWarehouseId,
        productName: selectedStock.productName,
        category: selectedStock.category,
        box: Number(box),
        piecesPerBox: Number(piecesPerBox),
        pricePerItem: Number(pricePerItem),
        total: totalItem,
        stockId: stockId,
        dateKey: selectedStock.dateKey,
      };

      setItems([...items, newItem]);
      setSubtotal((prev) => round2(prev + totalItem));
    }

    setSelectedStock(null);
    setBox("");
    setPiecesPerBox("");
    setPricePerItem("");
    setStockWarning("");
  };


  const handleDeleteItem = (index) => {
    const itemToDelete = items[index];
    if (!itemToDelete) return;

    const restoredPieces =
      Number(itemToDelete.box) * Number(itemToDelete.piecesPerBox);

    // ✅ RESTORE TEMP STOCK
    setTempStock((prev) => {
      if (!prev[itemToDelete.stockId]) return prev;

      return {
        ...prev,
        [itemToDelete.stockId]: {
          ...prev[itemToDelete.stockId],
          availablePieces:
            prev[itemToDelete.stockId].availablePieces + restoredPieces,
        },
      };
    });

    // ✅ REMOVE ITEM
    setItems((prev) => prev.filter((_, i) => i !== index));

    // ✅ UPDATE SUBTOTAL
    setSubtotal((prev) =>
      round2(prev - (Number(itemToDelete.total) || 0))
    );
  };

  const updateStockAfterSale = async (saleItems) => {
    for (const item of saleItems) {
      const stockRef = ref(db, `stocks/${item.dateKey}/${item.stockId}`);

      await runTransaction(stockRef, (current) => {
        if (!current) return current;

        const piecesPerBox = Number(current.piecesPerBox) || 1;

        const totalPieces =
          (Number(current.boxes) || 0) * piecesPerBox +
          (Number(current.pieces) || 0);

        const soldPieces =
          Number(item.box || 0) * Number(item.piecesPerBox || 0);

        const remainingPieces = totalPieces - soldPieces;
        if (remainingPieces < 0) return current;

        return {
          ...current,
          boxes: Math.floor(remainingPieces / piecesPerBox),
          pieces: remainingPieces % piecesPerBox,
        };
      });
    }
  };

  const getDateOnly = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const mergeItems = (oldItems = [], newItems = []) => {
  const map = new Map();

  oldItems.forEach(item => {
    const key = `${item.stockId}_${item.pricePerItem}`;
    map.set(key, { ...item });
  });

  newItems.forEach(item => {
    const key = `${item.stockId}_${item.pricePerItem}`;

    if (map.has(key)) {
      const existing = map.get(key);
      const newBox = existing.box + item.box;

      map.set(key, {
        ...existing,
        box: newBox,
        total: round2(newBox * existing.piecesPerBox * existing.pricePerItem),
      });
    } else {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};


  const handleCreateSales = async () => {
    if (!selectedPartyId) return toast.error("Select party");
    if (!selectedWarehouseId) return toast.error("Select warehouse");
    if (items.length === 0) return toast.error("Add items");

    try {
      const newISO = formatToISO(createdAt);
      const newDateKey = getDateKeyFromISO(newISO);

      // ===========================
      // ✏️ EDIT MODE (UNCHANGED)
      // ===========================
      if (invoiceToEdit) {
        const selectedDate = createdAt;
        const oldISO = invoiceToEdit.createdAt;

        const newISO =
          oldISO.split("T")[0] !== formatToISO(selectedDate).split("T")[0]
            ? `${formatToISO(selectedDate).split("T")[0]}T${oldISO.split("T")[1]}`
            : oldISO;

        const freshSubtotal = calculateSubtotalFromItems(items);

        if (round2(subtotal) !== freshSubtotal) {
          toast.error("Subtotal mismatch detected. Please recheck items.");
          return;
        }

        const newPath = `sales/${newISO}/invoice-${invoiceToEdit.invoiceNumber}`;

        await set(ref(db, newPath), {
          ...invoiceToEdit,
          createdAt: newISO,
          partyId: selectedPartyId,
          warehouseId: selectedWarehouseId,
          items,
          subtotal: freshSubtotal,
          total: freshSubtotal,
          invoiceNumber: invoiceToEdit.invoiceNumber,
        });

        const salesRef = ref(db, "sales");

        await new Promise((resolve) => {
          onValue(
            salesRef,
            (snap) => {
              const data = snap.val() || {};

              Object.entries(data).forEach(([dateKey, invoices]) => {
                Object.entries(invoices || {}).forEach(([key, inv]) => {
                  if (
                    inv.invoiceNumber === invoiceToEdit.invoiceNumber &&
                    dateKey !== newISO
                  ) {
                    set(ref(db, `sales/${dateKey}/${key}`), null);
                  }
                });
              });

              resolve();
            },
            { onlyOnce: true }
          );
        });

        toast.success(
          `Invoice updated! Invoice No: ${invoiceToEdit.invoiceNumber}`
        );
        return navigate("/sales", { state: { goToLastPage: true } });
      }

      // =====================================================
      // 🔁 MERGE LOGIC (SAME PARTY + WAREHOUSE + SAME DAY)
      // =====================================================
      const daySalesRef = ref(db, `sales/${newDateKey}`);

      let merged = false;

      await new Promise((resolve) => {
        onValue(
          daySalesRef,
          async (snap) => {
            const daySales = snap.val() || {};

            for (const [key, sale] of Object.entries(daySales)) {
              if (
                sale.partyId === selectedPartyId &&
                sale.warehouseId === selectedWarehouseId
              ) {
                const mergedItems = mergeItems(sale.items || [], items);
                const mergedSubtotal =
                  calculateSubtotalFromItems(mergedItems);

                await set(ref(db, `sales/${newDateKey}/${key}`), {
                  ...sale,
                  items: mergedItems,
                  subtotal: mergedSubtotal,
                  total: mergedSubtotal,
                  updatedAt: newISO,
                });

                await updateStockAfterSale(items);

                toast.success(
                  `Merged into Invoice No: ${sale.invoiceNumber}`
                );

                merged = true;
                navigate("/sales", { state: { goToLastPage: true } });
                break;
              }
            }

            resolve();
          },
          { onlyOnce: true }
        );
      });

      if (merged) return;

      // ===========================
      // 🆕 CREATE NEW INVOICE
      // ===========================
      const counterRef = ref(db, "invoiceCounter");
      const counterRes = await runTransaction(
        counterRef,
        (cur) => (Number(cur) || 1000) + 1
      );

      const invoiceNumber = counterRes.snapshot.val();
      const saleRef = ref(db, `sales/${newDateKey}/invoice-${invoiceNumber}`);

      const selectedParty = parties.find((p) => p.id === selectedPartyId);

      let dueDate = null;
      if (selectedParty?.creditPeriod) {
        dueDate = new Date(createdAt);
        dueDate.setDate(dueDate.getDate() + Number(selectedParty.creditPeriod));
      }

      await set(saleRef, {
        createdAt: newISO,
        dueDate: dueDate ? formatToISO(dueDate) : null,
        partyId: selectedPartyId,
        warehouseId: selectedWarehouseId,
        items,
        subtotal,
        total: subtotal,
        invoiceNumber,
      });

      await updateStockAfterSale(items);

      toast.success(`Sale saved! Invoice No: ${invoiceNumber}`);
      setItems([]);
      setSubtotal(0);
    } catch (err) {
      console.error(err);
      toast.error("Error saving sale");
    }
  };

  // FILTERED LISTS (CASE-INSENSITIVE)
  const filteredParties = parties
    .map(p => ({ ...p, name: (p.name || "").trim() }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(p => {
      const combined = `${p.name} ${p.id}`.toUpperCase();
      const search = (partySearchText || "").trim().toUpperCase();
      return search === "" || combined.includes(search);
    });

  const filteredCategories = Array.from(
    new Set(
      stocks
        .filter(s => s.warehouse === selectedWarehouseName)
        .map(s => s.category)
        .filter(Boolean)
    )
  ).filter(cat => {
    const name = (cat || "").toUpperCase();
    const search = (categorySearchText || "").trim().toUpperCase();
    return search === "" || name.startsWith(search);
  });

  const filteredStocks =
    selectedCategory && selectedWarehouseName
      ? stocks.filter(s => {
          const normalize = (str = "") =>
    str
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""); // remove spaces, dots, brackets, symbols

        const combined = normalize(`${s.productName} ${s.id}`);
        const search = normalize(productSearchText);

          return (
            s.category === selectedCategory &&
            s.warehouse === selectedWarehouseName &&
            (search === "" || combined.includes(search))
          );
        })
      : [];

  const totalBoxes = items.reduce((sum, item) => sum + Number(item.box || 0), 0);

  // --- RENDERING (same as before, just use filteredParties, filteredCategories, filteredStocks) ---


  return (
    <div className="max-w-6xl mx-auto p-6 mt-10 space-y-6">
      {/* HEADER */}
      <header className="flex items-center justify-between py-2 sm:py-3 border-b border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/sales")}
          className="h-8 w-8 sm:h-9 sm:w-9 p-0 sm:p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground/90">
            {invoiceToEdit ? "Edit Sales Invoice" : "Create Sales Invoice"}
          </h1>
        </div>
        <div className="w-8" />
      </header>

      {/* Party, Date & Warehouse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* PARTY */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Party</label>
          <Popover open={partyOpen} onOpenChange={setPartyOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between px-3"
                disabled={items.length > 0}
              >
                {selectedPartyName || "-- Choose Party --"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[260px]">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Type first letter..."
                  value={partySearchText}
                  onValueChange={setPartySearchText}
                />
                <CommandList>
                  <CommandEmpty>No party found.</CommandEmpty>
                  {parties
                    .map(p => ({ ...p, name: (p.name || "").trim() })) // trim spaces
                    .sort((a, b) => a.name.localeCompare(b.name))       // sort A→Z
                    .filter(p => {
                      const name = p.name.toUpperCase();               // party name in uppercase
                      const search = (partySearchText || "").trim().toUpperCase(); // input in uppercase
                      return search === "" || name.startsWith(search); // match multiple letters
                    })
                    .map((p, i) => (
                      <CommandItem
                        key={i}
                        value={p.id}
                        onSelect={() => {
                          if (items.length === 0) {
                            setSelectedPartyId(p.id);
                            setPartyOpen(false);
                          } else {
                            alert("Party cannot be changed after adding items.");
                          }
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPartyId === p.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {p.name}
                      </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* DATE */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Invoice Date</label>
          <DatePicker
            selected={createdAt}
            onChange={(date) => {
              setCreatedAt(date);
              localStorage.setItem("lastSalesDate", date.toISOString());
            }}
            timeIntervals={1}
            dateFormat="dd/MM/yyyy"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            maxDate={new Date()}
          />
        </div>

        

        {/* WAREHOUSE */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Warehouse</label>
          <Popover open={warehouseOpen} onOpenChange={setWarehouseOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between px-3"
                disabled={items.length > 0}
              >
                {selectedWarehouseName || "-- Select Warehouse --"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[260px]">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search warehouse..." onValueChange={setWarehouseSearchText} />
                <CommandList>
                  <CommandEmpty>No warehouse found.</CommandEmpty>
                  {warehouses
                    .filter(w =>
                      (w.name || "")
                        .toLowerCase()
                        .includes(warehouseSearchText.toLowerCase())
                    )
                    .map((w, i) => (
                      <CommandItem
                        key={i}
                        onSelect={() => {
                          setSelectedWarehouseId(w.id);
                          setWarehouseOpen(false);
                        }}
                      >
                        <Check className={cn(
                          "mr-2 h-4 w-4",
                          selectedWarehouseId === w.id ? "opacity-100" : "opacity-0"
                        )} />
                        {w.name}
                      </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* CATEGORY & PRODUCT */}
      <div className="flex gap-3 mt-4 items-end w-full">
        {/* CATEGORY */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-sm font-medium">Category</label>
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between px-3">
                {selectedCategory || "Select Category"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[260px]">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search category..." onValueChange={setCategorySearchText} />
                <CommandList>
                  <CommandEmpty>No category found.</CommandEmpty>
                  {Array.from(
                    new Set(
                      stocks
                        .filter(s => s.warehouse === selectedWarehouseName)
                        .map(s => s.category)
                        .filter(Boolean)
                    )
                  )
                    .filter(cat => cat.toLowerCase().includes(categorySearchText.toLowerCase()))
                    .map((cat, i) => (
                      <CommandItem key={i} onSelect={() => { setSelectedCategory(cat); setSelectedStock(null); setCategoryOpen(false); }}>
                        {cat}
                      </CommandItem>
                    ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* PRODUCT */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-sm font-medium">Product</label>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between px-3">
                {selectedStock ? selectedStock.productName : "Select Product"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[260px]">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search product..." onValueChange={setProductSearchText} />
                <CommandList>
                  <CommandEmpty>No product found.</CommandEmpty>
                  {filteredStocks.map(s => (
                    <CommandItem key={s.id} value={s.id} onSelect={() => handleSelectStock(s)}>
                      <Check className={cn("mr-2 h-4 w-4", selectedStock?.id === s.id ? "opacity-100" : "opacity-0")} />
                      {s.productName}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* BOX */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-sm font-medium">Box</label>
          <Input 
            type="number" 
            value={box} 
            onChange={(e) => setBox(e.target.value)} 
            ref={boxInputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                priceInputRef.current?.focus();
                priceInputRef.current?.select();
              }
            }}
          />
          {stockWarning && <p className="text-red-500 text-xs mt-1">{stockWarning}</p>}
        </div>

        {/* PIECES PER BOX */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-sm font-medium">Pieces/Box</label>
          <Input type="number" value={piecesPerBox} readOnly className="bg-slate-100" />
        </div>

        {/* PRICE PER ITEM */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-sm font-medium">Price/Item</label>
          <Input 
            type="number" 
            step="0.01" 
            value={pricePerItem} 
            onChange={(e) => setPricePerItem(e.target.value)} 
            ref={priceInputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddItem(); // 🔥 auto-submit
              }
            }}
          />
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <Button 
        className="bg-primary"
        onClick={handleAddItem}
        >
          Add to Invoice
          </Button>
      </div>

      {/* ITEMS TABLE */}
      <div className="overflow-x-auto bg-white p-4 rounded-xl shadow-sm border mt-4">
        <table className="w-full border text-sm text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">S.R</th>
              <th className="border p-2">Category</th>
              <th className="border p-2">Product</th>
              <th className="border p-2">Box</th>
              <th className="border p-2">Pieces</th>
              <th className="border p-2">Price</th>
              <th className="border p-2">Total</th>
              <th className="border p-2">Action</th>
            </tr>
          </thead>
 
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center p-4">No items added.</td>
              </tr>
            ) : items.map((item, i) => (
              <tr key={i}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2">{item.category}</td>

                {/* PRODUCT NAME */}
                <td className="border p-2">
                  {item.isEditable ? (
                    <Input
                      value={item.productName || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems(prev => {
                          const copy = [...prev];
                          copy[i].productName = val;
                          copy[i].total = calculateItemTotal(copy[i]);
                          return copy;
                        });
                      }}
                    />
                  ) : item.productName}
                </td>

                {/* BOX */}
                <td className="border p-2">{Number(item.box) || 0}</td>

                {/* PIECES PER BOX */}
                <td className="border p-2">{Number(item.piecesPerBox) || 0}</td>

                {/* PRICE PER ITEM */}
                <td className="border p-2">
                  {item.isEditable ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={Number(item.pricePerItem) || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setItems(prev => {
                          const copy = [...prev];
                          copy[i].pricePerItem = val;
                          copy[i].total = calculateItemTotal(copy[i]);
                          return copy;
                        });
                      }}
                    />
                  ) : formatPrice(item.pricePerItem)}
                </td>

                {/* TOTAL */}
                <td className="border p-2">{formatPrice(Number(item.total) || 0)}</td>

                {/* DELETE ACTION */}
                <td className="border p-2">
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}

            {items.length > 0 && (
              <tr className="bg-gray-100 font-semibold">
                <td colSpan="2" className="border p-2"></td>
                <td className="border p-2 text-right">Total:</td>
                <td className="border p-2">{totalBoxes || 0}</td>
                <td className="border p-2"></td>
                <td className="border p-2 text-right">Grand Total:</td>
                <td className="border p-2">{formatPrice(subtotal || 0)}</td>
                <td className="border p-2"></td>
              </tr>
            )}
          </tbody>

        </table>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={handleCreateSales}>{invoiceToEdit ? "Update Invoice" : "Create Invoice"}</Button>
      </div>
    </div>
  );
};

export default SalesInvoice;
