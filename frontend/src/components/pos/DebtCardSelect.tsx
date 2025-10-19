import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface DebtCardSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

interface DebtCardOption {
  label: string;
  value: string;
  isCreateOption?: boolean;
}

export function DebtCardSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  isLoading = false
}: DebtCardSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    options.forEach((option) => {
      const trimmed = option.trim();
      if (!trimmed) {
        return;
      }
      const key = trimmed.toLocaleLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      list.push(trimmed);
    });
    return list;
  }, [options]);

  const searchValue = searchTerm.trim();
  const searchValueLower = searchValue.toLocaleLowerCase();

  const filteredOptions = useMemo(() => {
    if (!searchValueLower) {
      return normalizedOptions;
    }
    return normalizedOptions.filter((option) => option.toLocaleLowerCase().includes(searchValueLower));
  }, [normalizedOptions, searchValueLower]);

  const shouldShowCreateOption = Boolean(
    searchValue &&
    !normalizedOptions.some((option) => option.toLocaleLowerCase() === searchValueLower)
  );

  const listOptions: DebtCardOption[] = useMemo(() => {
    const list: DebtCardOption[] = [];
    if (shouldShowCreateOption) {
      list.push({
        label: t('debtCardSelectCreate', { term: searchValue }),
        value: searchValue,
        isCreateOption: true
      });
    }
    list.push(
      ...filteredOptions.map((option) => ({
        label: option,
        value: option
      }))
    );
    return list;
  }, [filteredOptions, searchValue, shouldShowCreateOption, t]);

  const selectedOption = listOptions.find((option) => option.value === value);
  const buttonLabel = selectedOption?.label || value.trim() || placeholder || t('debtCardSelectPlaceholder');

  useEffect(() => {
    if (!open) {
      return;
    }
    optionRefs.current = [];
    setHighlightedIndex((previous) => {
      if (listOptions.length === 0) {
        return -1;
      }
      if (previous < 0 || previous >= listOptions.length) {
        return 0;
      }
      return previous;
    });
  }, [open, listOptions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (highlightedIndex < 0) {
      return;
    }
    const element = optionRefs.current[highlightedIndex];
    if (element) {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  const handleSelect = (nextValue: string) => {
    const trimmed = nextValue.trim();
    onChange(trimmed);
    setOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    buttonRef.current?.focus();
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setOpen((previous) => !previous);
  };

  const handleKeyDownOnButton = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
    }
    if (event.key === 'Escape' && open) {
      setOpen(false);
      setSearchTerm('');
    }
  };

  const handleKeyDownOnSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((previous) => {
        if (listOptions.length === 0) {
          return -1;
        }
        if (previous < 0) {
          return 0;
        }
        return previous + 1 >= listOptions.length ? 0 : previous + 1;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((previous) => {
        if (listOptions.length === 0) {
          return -1;
        }
        if (previous <= 0) {
          return listOptions.length - 1;
        }
        return previous - 1;
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < listOptions.length) {
        handleSelect(listOptions[highlightedIndex].value);
      } else if (shouldShowCreateOption) {
        handleSelect(searchValue);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearchTerm('');
      buttonRef.current?.focus();
    }
  };

  const handleKeyDownOnOption = (
    event: React.KeyboardEvent<HTMLLIElement>,
    index: number,
    option: DebtCardOption
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(option.value);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index + 1) % listOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index - 1 + listOptions.length) % listOptions.length);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearchTerm('');
      buttonRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
          open ? 'ring-2 ring-emerald-500' : ''
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={handleKeyDownOnButton}
        disabled={disabled}
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="ml-2 text-xs text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="p-2">
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('debtCardSelectSearchPlaceholder')}
              onKeyDown={handleKeyDownOnSearch}
            />
          </div>
          <ul
            className="max-h-48 overflow-auto py-1 text-sm"
            role="listbox"
            aria-activedescendant={
              highlightedIndex >= 0 ? `debt-card-option-${highlightedIndex}` : undefined
            }
          >
            {isLoading ? (
              <li className="px-3 py-2 text-slate-500 dark:text-slate-300">
                {t('debtCardSelectLoading')}
              </li>
            ) : listOptions.length === 0 ? (
              <li className="px-3 py-2 text-slate-500 dark:text-slate-300">
                {t('debtCardSelectNoResults')}
              </li>
            ) : (
              listOptions.map((option, index) => (
                <li
                  key={option.value}
                  id={`debt-card-option-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  tabIndex={-1}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-900/40',
                    highlightedIndex === index
                      ? 'bg-emerald-100 font-semibold dark:bg-emerald-800/50'
                      : ''
                  )}
                  onClick={() => handleSelect(option.value)}
                  onKeyDown={(event) => handleKeyDownOnOption(event, index, option)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
