import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  ChevronsUpDown,
  Check,
  Pencil,
  Trash,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { ref, push, onValue, update, remove } from "firebase/database";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { Popover, PopoverTrigger, PopoverContent } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { Command, CommandInput, CommandList, CommandItem } from "../../components/ui/command";
import { cn } from "../../lib/utils";

const ProductEntry = () => {
  const navigate = useNavigate();

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);

  const [createdAt, setCreatedAt] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [piecesPerBox, setPiecesPerBox] = useState("");

  // Popups
  const [showCatPopup, setShowCatPopup] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState(null);

  const [isSpecialCategory, setIsSpecialCategory] = useState(false);

  useEffect(() => {
    const catRef = ref(db, "categories");
    onValue(catRef, (snapshot) => {
      const data = snapshot.val() || {};
      setCategories(
        Object.keys(data).map((id) => ({
          id,
          name: data[id].name,
          specialCate: data[id].specialCate || false, // fetch the flag
        }))
      );
    });
  }, []);

 // Inside your component
const [successMessage, setSuccessMessage] = useState(""); // <-- added

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!productName || !categoryId || Number(piecesPerBox) < 1) {
    alert("Please fill all fields correctly");
    return;
  }

  await push(ref(db, "products"), {
    productName,
    category,
    categoryId,
    createdAt: createdAt.toISOString().slice(0, 10),
    notes,
    piecesPerBox: Number(piecesPerBox),
    stockPieces: 0,
  });

  // Show on-screen success message
  setSuccessMessage("Product saved successfully");

  // Clear the message after 3 seconds
  setTimeout(() => setSuccessMessage(""), 3000);

  // Reset form
  setProductName("");
  setCategory("");
  setCategoryId("");
  setNotes("");
  setPiecesPerBox("");
  setCreatedAt(new Date());
};


  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-3">
        <button
          type="button"
          onClick={() => navigate("/product")}
          className="h-9 w-9 flex items-center justify-center rounded hover:bg-gray-200"
        >
          <ArrowLeft />
        </button>
        <h1 className="text-lg font-semibold">Add New Product</h1>
        <div className="w-9" />
      </header>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-6"
      >
        {/* Product Name */}
        <div>
          <label className="text-sm font-medium">Product Name</label>
          <input
            className="w-full h-10 border rounded px-3"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
        </div>

        {/* Category + Pieces */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button" // <-- FIX
                    variant="outline"
                    className="flex-1 justify-between"
                  >
                    {category || "Select Category"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[260px] p-0">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      {categories.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.name}
                          className="flex justify-between"
                        >
                          <div
                            className="flex items-center gap-2 flex-1"
                            onClick={() => {
                              setCategory(cat.name);
                              setCategoryId(cat.id);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                categoryId === cat.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cat.name}
                          </div>

                          <div className="flex gap-2">
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                setEditCategoryId(cat.id);
                                setEditCategoryName(cat.name);
                                setShowEditPopup(true);
                              }}
                            >
                              <Pencil size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                setDeleteCategoryId(cat.id);
                                setShowDeletePopup(true);
                              }}
                            >
                              <Trash size={14} className="text-red-500" />
                            </button>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Add Category */}
              <Button type="button" onClick={() => setShowCatPopup(true)}>
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {/* Pieces */}
          <div>
            <label className="text-sm font-medium">Pieces</label>
            <input
              type="number"
              min="1"
              className="w-full h-10 border rounded px-3"
              value={piecesPerBox}
              onChange={(e) => setPiecesPerBox(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Date + Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Created On</label>
            <DatePicker
              selected={createdAt}
              onChange={(d) => setCreatedAt(d)}
              dateFormat="dd/MM/yyyy"
              className="w-full border rounded px-3 py-2"
              maxDate={new Date()} 
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              rows="2"
              className="w-full border rounded px-3 py-2 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit">Save Product</Button>
        </div>
      </form>

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded mb-4">
          {successMessage}
        </div>
      )}


      {/* ADD CATEGORY POPUP */}
      {showCatPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-80">
            <h3 className="font-semibold mb-3">Add New Category</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              placeholder="Category name"
            />
            <input
              type="checkbox"
              id="specialCategory"
              checked={isSpecialCategory}
              onChange={(e) => setIsSpecialCategory(e.target.checked)}
              className="h-4 w-4 mr-2"
            />
            <label htmlFor="specialCategory" className="text-sm">
              Special Category (hidden from stock)
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCatPopup(false);
                  setNewCategoryName("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!newCategoryName.trim()) return;
                  await push(ref(db, "categories"), {
                    name: newCategoryName.trim(),
                    specialCate: isSpecialCategory, // <--- send the flag to DB
                  });
                  setShowCatPopup(false);
                  setNewCategoryName("");
                  setIsSpecialCategory(false); // reset checkbox
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY */}
      {showEditPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-80">
            <h3 className="font-semibold mb-3">Edit Category</h3>
            <input
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditPopup(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={async () => {
                  await update(ref(db, `categories/${editCategoryId}`), { name: editCategoryName });
                  setShowEditPopup(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY */}
      {showDeletePopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-80">
            <h3 className="font-semibold mb-2">Delete Category?</h3>
            <p className="text-sm text-gray-600 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDeletePopup(false)}>Cancel</Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  remove(ref(db, `categories/${deleteCategoryId}`));
                  setShowDeletePopup(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductEntry;
 