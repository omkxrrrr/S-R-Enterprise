import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
import { db } from "../../firebase";
import { ref, get, set, update } from "firebase/database";
import { cn } from "../../lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function AddExpense() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState("");
  const [expenseFor, setExpenseFor] = useState("");

  const [category, setCategory] = useState("");
  const [entity, setEntity] = useState(null); // ✅ OBJECT {id, name}

  const [parties, setParties] = useState([]);
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [entityOpen, setEntityOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  /* ---------------- LOCK FROM LEDGER ---------------- */
  useEffect(() => {
    if (
      state?.lockCategory &&
      state?.lockEntity &&
      typeof state.lockEntity === "object"
    ) {
      setCategory(state.lockCategory);
      setEntity(state.lockEntity);
    }
  }, [state]);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    get(ref(db, "parties")).then((s) => {
      if (s.exists()) {
        setParties(
          Object.entries(s.val()).map(([id, v]) => ({
            id,
            name: v.name,
          }))
        );
      }
    });

    get(ref(db, "banks")).then((s) => {
      if (s.exists()) {
        setBanks(
          Object.entries(s.val()).map(([id, v]) => ({
            id,
            name: v.bankName,
          }))
        );
      }
    });

    get(ref(db, "accounts")).then((s) => {
      if (s.exists()) {
        setAccounts(
          Object.entries(s.val()).map(([id, v]) => ({
            id,
            name: v.name,
          }))
        );
      }
    });
  }, []);

  const getEntities = () => {
    if (category === "party") return parties;
    if (category === "bank") return banks;
    if (category === "account") return accounts;
    return [];
  };

  /* ---------------- SAVE EXPENSE ---------------- */
  const handleSaveExpense = async () => {
    if (!amount || !expenseFor || !category || !entity) {
      alert("Please fill all fields");
      return;
    }

    const expenseAmount = Number(amount);
    if (expenseAmount <= 0) {
      alert("Invalid amount");
      return;
    }

    const expenseID = Date.now();

    const expenseEntry = {
      amount: expenseAmount,
      expenseFor,
      date: date.toISOString(),
      createdAt: new Date().toISOString(),
      category,
      entity: entity.name, // ✅ EXACTLY AS YOU WANT
    };

    const baseNode =
      category === "party"
        ? "parties"
        : category === "bank"
        ? "banks"
        : "accounts";

    try {
      const bankRef = ref(db, `${baseNode}/${entity.id}`);

      // 1️⃣ Get latest balance
      const snap = await get(bankRef);
      if (!snap.exists()) {
        alert("Account not found");
        return;
      }

      const data = snap.val();
      const currentBalance = Number(data.balance || 0);

      const updatedBalance = Number(
        (currentBalance - expenseAmount).toFixed(2)
      );

      // 3️⃣ Update balance SAFELY
      await update(bankRef, {
        balance: updatedBalance,
      });

      // 4️⃣ Save expense under entity
      await set(
        ref(db, `${baseNode}/${entity.id}/expenses/${expenseID}`),
        expenseEntry
      );

      // 5️⃣ Save global expense (for reports)
      await set(
        ref(db, `expenses/${category}/${entity.name}/${expenseID}`),
        expenseEntry
      );

      alert("✅ Expense saved successfully");

      setDate(new Date());
      setAmount("");
      setExpenseFor("");

    } catch (err) {
      console.error(err);
      alert("❌ Error saving expense");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">Add Expense</h1>
        <div className="w-8" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Entry</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <DatePicker
                selected={date}
                onChange={setDate}
                className="w-full border p-2 rounded"
                dateFormat="dd/MM/yyyy"
              />
            </div>

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Expense For</Label>
            <Input
              value={expenseFor}
              onChange={(e) => setExpenseFor(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <select
                className="w-full border p-2 rounded"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setEntity(null);
                }}
                disabled={!!state?.lockCategory}
              >
                <option value="">Select</option>
                <option value="party">Party</option>
                <option value="bank">Bank</option>
                <option value="account">Account</option>
              </select>
            </div>

            {category && (
              <div>
                <Label>{category}</Label>
                <Popover open={entityOpen} onOpenChange={setEntityOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {entity?.name || "Select"}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="p-0 w-[250px]">
                    <Command>
                      <CommandInput
                        placeholder="Search..."
                        onValueChange={setSearchText}
                      />
                      <CommandList>
                        <CommandEmpty>No results</CommandEmpty>
                        {getEntities()
                          .filter((e) =>
                            e.name
                              .toLowerCase()
                              .includes(searchText.toLowerCase())
                          )
                          .map((e) => (
                            <CommandItem
                              key={e.id}
                              onSelect={() => {
                                setEntity(e);
                                setEntityOpen(false);
                                setSearchText("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  entity?.id === e.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {e.name}
                            </CommandItem>
                          ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <Button className="w-full mt-4" onClick={handleSaveExpense}>
            <Save className="h-4 w-4 mr-2" />
            Save Expense
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
