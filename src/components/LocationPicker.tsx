'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ChevronRight, X, Check, Globe2, Building2, Landmark, Loader2 } from 'lucide-react';

export interface LocationItem {
  id: string;
  parentId: string;
  name: string;
  nameKk?: string;
  type: string;
  kato: string;
  breadcrumb: string;
}

interface LocationPickerProps {
  currentKatoCode?: string;
  currentLocationId?: string;
  currentLocationAddress?: string;
  onChange: (location: {
    katoCode: string;
    katoNameRu: string;
    locationId: string;
    locationAddress: string;
  }) => void;
  disabled?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  currentKatoCode,
  currentLocationId,
  currentLocationAddress,
  onChange,
  disabled = false,
}) => {
  const [mode, setMode] = useState<'search' | 'tree'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);

  // Каскадная иерархия
  const [regions, setRegions] = useState<LocationItem[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [districts, setDistricts] = useState<LocationItem[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [settlements, setSettlements] = useState<LocationItem[]>([]);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>('');
  const [isLoadingLevel, setIsLoadingLevel] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Загрузка корневых 20 регионов при монтировании
  useEffect(() => {
    fetch('/api/locations?parentId=00')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.locations) {
          setRegions(data.locations);
        }
      })
      .catch((err) => console.error('Ошибка загрузки регионов:', err));
  }, []);

  // Клик вне компонента закрывает выпадающий поиск
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Поиск с debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      fetch(`/api/locations?query=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          setIsSearching(false);
          if (data.success && data.locations) {
            setSearchResults(data.locations);
            setIsOpenDropdown(true);
          }
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Загрузка районов при смене региона
  const handleSelectRegion = async (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedDistrictId('');
    setSelectedSettlementId('');
    setDistricts([]);
    setSettlements([]);

    if (!regionId) return;

    const reg = regions.find((r) => r.id === regionId);
    if (reg) {
      onChange({
        katoCode: reg.kato,
        katoNameRu: reg.name,
        locationId: reg.id,
        locationAddress: reg.breadcrumb || reg.name,
      });
    }

    setIsLoadingLevel(true);
    try {
      const res = await fetch(`/api/locations?parentId=${regionId}`);
      const data = await res.json();
      if (data.success && data.locations) {
        setDistricts(data.locations);
      }
    } finally {
      setIsLoadingLevel(false);
    }
  };

  // Загрузка населенных пунктов при смене района
  const handleSelectDistrict = async (districtId: string) => {
    setSelectedDistrictId(districtId);
    setSelectedSettlementId('');
    setSettlements([]);

    if (!districtId) return;

    const dist = districts.find((d) => d.id === districtId);
    if (dist) {
      onChange({
        katoCode: dist.kato,
        katoNameRu: dist.name,
        locationId: dist.id,
        locationAddress: dist.breadcrumb || dist.name,
      });
    }

    setIsLoadingLevel(true);
    try {
      const res = await fetch(`/api/locations?parentId=${districtId}`);
      const data = await res.json();
      if (data.success && data.locations) {
        setSettlements(data.locations);
      }
    } finally {
      setIsLoadingLevel(false);
    }
  };

  // Выбор населенного пункта (Уровень 3)
  const handleSelectSettlement = (settlementId: string) => {
    setSelectedSettlementId(settlementId);
    if (!settlementId) return;

    const sett = settlements.find((s) => s.id === settlementId);
    if (sett) {
      onChange({
        katoCode: sett.kato,
        katoNameRu: sett.name,
        locationId: sett.id,
        locationAddress: sett.breadcrumb || sett.name,
      });
    }
  };

  const handlePickSearchResult = (item: LocationItem) => {
    onChange({
      katoCode: item.kato,
      katoNameRu: item.name,
      locationId: item.id,
      locationAddress: item.breadcrumb || item.name,
    });
    setSearchQuery('');
    setIsOpenDropdown(false);
  };

  const handleClearLocation = () => {
    onChange({
      katoCode: '',
      katoNameRu: '',
      locationId: '',
      locationAddress: '',
    });
    setSelectedRegionId('');
    setSelectedDistrictId('');
    setSelectedSettlementId('');
    setDistricts([]);
    setSettlements([]);
  };

  // Режим только для чтения
  if (disabled) {
    return (
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {currentLocationAddress || 'Географическая привязка не указана'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Карточка текущей выбранной локации */}
      {currentLocationAddress ? (
        <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start justify-between gap-3 transition-all">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Закрепленная локация
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                {currentLocationAddress}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearLocation}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
            title="Сбросить локацию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-400">
          <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Локация еще не закреплена. Выберите населенный пункт ниже:</span>
        </div>
      )}

      {/* Переключатель режимов: Умный поиск или Иерархия */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mode === 'search'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Быстрый поиск города/села</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('tree')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mode === 'tree'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Выбор по уровням (Область → Район)</span>
        </button>
      </div>

      {/* РЕЖИМ 1: Быстрый поиск с автокомплитом */}
      {mode === 'search' && (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setIsOpenDropdown(true);
              }}
              placeholder="Введите город, район или село (напр. Каскелен, Есиль, Семей, Талгар)..."
              className="w-full pl-9 pr-8 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 outline-none shadow-2xs"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3 top-3 text-blue-500 animate-spin" />
            )}
            {!isSearching && searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Выпадающий список результатов */}
          {isOpenDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePickSearchResult(item)}
                  className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.breadcrumb}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {isOpenDropdown && !isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-center text-xs text-slate-400">
              Населенный пункт не найден. Проверьте написание или воспользуйтесь выбором по уровням.
            </div>
          )}
        </div>
      )}

      {/* РЕЖИМ 2: Каскадный выбор (Уровень 1 -> Уровень 2 -> Уровень 3) */}
      {mode === 'tree' && (
        <div className="space-y-2.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
          {/* Уровень 1: Область / Город республиканского значения */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-blue-500" />
              1. Область / Город республиканского значения:
            </label>
            <select
              value={selectedRegionId}
              onChange={(e) => handleSelectRegion(e.target.value)}
              className="w-full mt-1 p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- Выберите область или город респ. значения --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Уровень 2: Район / Город областного значения */}
          {selectedRegionId && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-500" />
                2. Район / Город областного значения:
              </label>
              <select
                value={selectedDistrictId}
                onChange={(e) => handleSelectDistrict(e.target.value)}
                disabled={isLoadingLevel || districts.length === 0}
                className="w-full mt-1 p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
              >
                <option value="">
                  {isLoadingLevel
                    ? 'Загрузка районов...'
                    : districts.length === 0
                    ? 'Районы не найдены'
                    : '-- Выберите район или город --'}
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Уровень 3: Населенный пункт / Сельский округ (если есть) */}
          {selectedDistrictId && settlements.length > 0 && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-pink-500" />
                3. Населенный пункт / Сельский округ (опционально):
              </label>
              <select
                value={selectedSettlementId}
                onChange={(e) => handleSelectSettlement(e.target.value)}
                disabled={isLoadingLevel}
                className="w-full mt-1 p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Конкретный населенный пункт / округ --</option>
                {settlements.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
