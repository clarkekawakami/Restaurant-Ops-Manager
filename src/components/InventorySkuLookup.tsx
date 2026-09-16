import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, ChevronDown, Check, Plus, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types.ts';

interface InventorySkuLookupProps {
  value: string; // inventory_item_id
  driverName?: string;
  inventoryList: InventoryItem[];
  onSelect: (item: InventoryItem | null) => void;
  onOpenNewSkuModal: (initialName?: string) => void;
  placeholder?: string;
  isRequired?: boolean;
}

export const InventorySkuLookup: React.FC<InventorySkuLookupProps> = ({
  value,
  driverName,
  inventoryList,
  onSelect,
  onOpenNewSkuModal,
  placeholder = 'enter ingredient name here',
  isRequired = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently linked item if any
  const currentLinkedItem = inventoryList.find((item) => item.id === value);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(
    currentLinkedItem ? currentLinkedItem.name : ''
  );
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [matchingIngredients, setMatchingIngredients] = useState<InventoryItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Sync inputValue when external value or linked item changes
  useEffect(() => {
    if (!isOpen) {
      if (currentLinkedItem) {
        setInputValue(currentLinkedItem.name);
      } else {
        setInputValue('');
      }
    }
  }, [value, currentLinkedItem, isOpen]);

  // Debounced search logic:
  // When input reaches 3 characters and after a half second (500ms) pause,
  // populates the dropdown with ingredients containing the query substring.
  useEffect(() => {
    const query = inputValue.trim();

    if (query.length < 3) {
      setIsDebouncing(false);
      setDebouncedQuery('');
      setMatchingIngredients([]);
      return;
    }

    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setIsDebouncing(false);
      setDebouncedQuery(query);
      const qLower = query.toLowerCase();
      const matches = inventoryList.filter((item) =>
        item.name.toLowerCase().includes(qLower)
      );
      setMatchingIngredients(matches);
      setHighlightedIndex(matches.length > 0 ? 0 : -1);
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue, inventoryList]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset displayed text to linked item name or empty
        if (currentLinkedItem) {
          setInputValue(currentLinkedItem.name);
        } else {
          setInputValue('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentLinkedItem]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // If the input already has the linked item name, select text for quick overwrite/search
    if (inputRef.current && currentLinkedItem && inputValue === currentLinkedItem.name) {
      inputRef.current.select();
    }
  };

  const handleSelectSku = (item: InventoryItem) => {
    onSelect(item);
    setInputValue(item.name);
    setIsOpen(false);
    setDebouncedQuery('');
    setMatchingIngredients([]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setInputValue('');
    setDebouncedQuery('');
    setMatchingIngredients([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      if (currentLinkedItem) {
        setInputValue(currentLinkedItem.name);
      } else {
        setInputValue('');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (matchingIngredients.length > 0) {
        setHighlightedIndex((prev) => (prev < matchingIngredients.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (matchingIngredients.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : matchingIngredients.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < matchingIngredients.length) {
        handleSelectSku(matchingIngredients[highlightedIndex]);
      }
    }
  };

  const trimmedLen = inputValue.trim().length;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Searchable Select Input Trigger */}
      <div
        className={`relative flex items-center bg-slate-50 hover:bg-white focus-within:bg-white rounded-lg border transition shadow-2xs ${
          isOpen
            ? 'border-slate-900 ring-2 ring-slate-900/10 bg-white'
            : currentLinkedItem
            ? 'border-emerald-300 bg-emerald-50/20'
            : isRequired
            ? 'border-amber-300 bg-amber-50/20'
            : 'border-slate-200'
        }`}
      >
        {/* Left Icon: Search, Spinner, or Linked Indicator */}
        <div className="pl-2.5 pr-1.5 text-slate-400 pointer-events-none flex items-center">
          {isDebouncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : currentLinkedItem && !isOpen ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>

        {/* Combined "Driver Name / Component" Input with exact placeholder */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-1.5 pr-16 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden font-medium"
        />

        {/* Linked SKU Cost Pill (when linked and not actively searching) */}
        {currentLinkedItem && !isOpen && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded mr-1 whitespace-nowrap">
            <span>${currentLinkedItem.unit_cost.toFixed(2)}</span>
            <span className="text-emerald-600 font-normal">/{currentLinkedItem.unit}</span>
          </div>
        )}

        {/* Right action buttons: Clear (✕) and Dropdown Toggle (▼) */}
        <div className="absolute right-1 flex items-center gap-0.5">
          {(value || inputValue) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition"
              title="Clear ingredient selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen && inputRef.current) {
                inputRef.current.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition"
            title={isOpen ? 'Close list' : 'Open list'}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Floating Searchable Select Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-72 flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
          {/* Header Status Bar */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px]">
            {trimmedLen === 0 ? (
              <span className="text-slate-500 font-medium">
                Type 3+ characters to search inventory SKUs...
              </span>
            ) : trimmedLen < 3 ? (
              <span className="text-amber-700 font-medium">
                Type {3 - trimmedLen} more character{3 - trimmedLen > 1 ? 's' : ''} to search
              </span>
            ) : isDebouncing ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Searching after 0.5s pause...
              </span>
            ) : matchingIngredients.length === 0 ? (
              <span className="text-slate-500">
                0 SKUs containing &ldquo;{debouncedQuery}&rdquo;
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">
                {matchingIngredients.length} SKU{matchingIngredients.length > 1 ? 's' : ''} containing &ldquo;{debouncedQuery}&rdquo;
              </span>
            )}

            {currentLinkedItem && (
              <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Linked: {currentLinkedItem.name}
              </span>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-56 divide-y divide-slate-100">
            {/* Currently Linked item if not currently in matching results */}
            {currentLinkedItem &&
              !matchingIngredients.some((m) => m.id === currentLinkedItem.id) && (
                <button
                  type="button"
                  onClick={() => handleSelectSku(currentLinkedItem)}
                  className="w-full px-3 py-2 text-left flex items-center justify-between bg-emerald-50/40 hover:bg-emerald-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      ✓
                    </div>
                    <div>
                      <div className="font-semibold text-emerald-950 flex items-center gap-1.5">
                        <span>{currentLinkedItem.name}</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded">
                          Currently Linked
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        ${currentLinkedItem.unit_cost.toFixed(2)} / {currentLinkedItem.unit} • Stock: {currentLinkedItem.current_stock}
                      </div>
                    </div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                </button>
              )}

            {/* When fewer than 3 characters */}
            {trimmedLen < 3 && (
              <div className="p-4 text-center text-slate-400 space-y-1">
                <Search className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                <p className="text-[11px] text-slate-600 font-medium">
                  {trimmedLen === 0
                    ? 'Type 3+ characters to search inventory ingredients'
                    : `Enter ${3 - trimmedLen} more character${3 - trimmedLen > 1 ? 's' : ''}...`}
                </p>
                <p className="text-[10px] text-slate-400">
                  Matches ingredient names in your inventory after a 0.5s pause
                </p>
              </div>
            )}

            {/* Debouncing indicator */}
            {trimmedLen >= 3 && isDebouncing && (
              <div className="p-4 text-center text-amber-700 space-y-1">
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-amber-600 mb-1" />
                <p className="text-[11px] font-medium">Searching inventory items...</p>
                <p className="text-[10px] text-amber-600">Waiting for 0.5s pause in typing</p>
              </div>
            )}

            {/* Populated matching ingredients */}
            {trimmedLen >= 3 &&
              !isDebouncing &&
              matchingIngredients.map((item, idx) => {
                const isSelected = value === item.id;
                const isHighlighted = idx === highlightedIndex;
                const isLowStock = item.current_stock <= item.min_threshold;

                // Highlight matching substring
                const queryLower = debouncedQuery.toLowerCase();
                const nameLower = item.name.toLowerCase();
                const matchStart = nameLower.indexOf(queryLower);

                let beforeMatch = item.name;
                let matchText = '';
                let afterMatch = '';

                if (matchStart >= 0) {
                  beforeMatch = item.name.substring(0, matchStart);
                  matchText = item.name.substring(matchStart, matchStart + debouncedQuery.length);
                  afterMatch = item.name.substring(matchStart + debouncedQuery.length);
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSku(item)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition cursor-pointer ${
                      isHighlighted || isSelected
                        ? 'bg-amber-50/70 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {beforeMatch}
                          <mark className="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">
                            {matchText}
                          </mark>
                          {afterMatch}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-medium text-slate-700">
                          ${item.unit_cost.toFixed(2)} / {item.unit}
                        </span>
                        <span>•</span>
                        <span
                          className={`font-medium ${
                            isLowStock ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          Stock: {item.current_stock} {item.unit}
                        </span>
                        {item.supplier && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[110px]">{item.supplier}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-emerald-600 font-bold" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 rounded bg-slate-100 group-hover:bg-slate-200">
                          Select
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

            {/* No matches found: prompt to create new SKU */}
            {trimmedLen >= 3 && !isDebouncing && matchingIngredients.length === 0 && (
              <div className="p-4 text-center space-y-2">
                <AlertCircle className="w-5 h-5 mx-auto text-amber-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    No SKU found containing &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    All cost drivers must link to an inventory SKU.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNewSkuModal(debouncedQuery);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create &ldquo;{debouncedQuery}&rdquo; SKU</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Quick Action */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="text-[10px] text-amber-700 font-medium">
              * Inventory SKU link required
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenNewSkuModal(debouncedQuery || inputValue);
              }}
              className="text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>+ New SKU</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
