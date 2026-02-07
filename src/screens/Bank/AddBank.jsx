//C:\Users\omkar\Desktop\client\src\screens\Bank\AddBank.jsx
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState } from "react";

// Firebase
import { db } from "../../firebase";
import { ref, set } from "firebase/database";
import { v4 as uuidv4 } from "uuid";

const AddBank = () => {
  const navigate = useNavigate();

  const [bankName, setBankName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bankName.trim()) {
      return alert("Bank name is required");
    }

    const bankId = uuidv4();
    const opening = Number(openingBalance) || 0;
    const todayKey = getTodayKey();

    const bankData = {
      id: bankId,
      bankName: bankName.trim(),
      openingBalance: opening,
      balance: opening,
      createdAt: Date.now(),
      entries:
        opening !== 0
          ? {
              [todayKey]: {
                opening_balance: {
                  amount: opening,
                  note: "Opening Balance",
                  createdAt: Date.now(),
                },
              },
            }
          : {},
    };

    try {
      await set(ref(db, `banks/${bankId}`), bankData);
      alert("✅ Bank added successfully");
      navigate("/banks");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to add bank");
    }
  };

  return (
    <div className="min-h-screen flex justify-center pt-16 px-4">
      {/* Centered horizontally, top spaced */}
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center border-b pb-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/banks")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <h1 className="flex-1 text-center text-lg font-semibold">
            Add Bank
          </h1>

          <div className="w-9" />
        </div>

        {/* Card */}
        <Card>
          <CardHeader>
            <CardTitle>New Bank</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) =>
                    setOpeningBalance(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>

              <Button type="submit" className="w-full gap-2">
                <Save className="h-4 w-4" />
                Save Bank
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddBank;
