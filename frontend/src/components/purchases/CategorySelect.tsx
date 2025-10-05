import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface CategorySelectProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

interface CategoryOption {
  label: string;
  value: string;
  isCreateOption?: boolean;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  placeholder,
  disabled,
  name,
  required
}: CategorySelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const normalizedCategories = useMemo(() => {
    return categories.map((category) => category.trim()).filter(Boolean);
  }, [categories]);

  const searchValue = searchTerm.trim();
  const searchValueLower = searchValue.toLocaleLowerCase();

  const filteredCategories = useMemo(() => {
    if (!searchValueLower) {
      return normalizedCategories;
    }
    return normalizedCategories.filter((category) =>
      category.toLocaleLowerCase().includes(searchValueLower)
    );
  }, [normalizedCategories, searchValueLower]);

  const shouldShowCreateOption = Boolean(
    searchValue &&
      !normalizedCategories.some(
        (category) => category.toLocaleLowerCase() === searchValueLower
      )
  );

  const options: CategoryOption[] = useMemo(() => {
    const list: CategoryOption[] = [];
    if (shouldShowCreateOption) {
      list.push({
        label: t('categorySelectCreate', { term: searchValue }),
        value: searchValue,
        isCreateOption: true
      });
    }
    list.push(
      ...filteredCategories.map((category) => ({
        label: category,
        value: category
      }))
    );
    return list;
  }, [filteredCategories, searchValue, shouldShowCreateOption, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    optionRefs.current = [];
    setHighlightedIndex((previous) => {
      if (options.length === 0) {
        return -1;
      }
      if (previous < 0 || previous >= options.length) {
        return 0;
      }
      return previous;
    });
  }, [open, options]);

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
    onChange(nextValue);
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
        if (options.length === 0) {
          return -1;
        }
        if (previous < 0) {
          return 0;
        }
        return previous + 1 >= options.length ? 0 : previous + 1;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((previous) => {
        if (options.length === 0) {
          return -1;
        }
        if (previous <= 0) {
          return options.length - 1;
        }
        return previous - 1;
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelect(options[highlightedIndex].value);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearchTerm('');
      buttonRef.current?.focus();
    }
  };

  const handleContainerBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className="relative" onBlur={handleContainerBlur}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500',
          value ? 'text-slate-700 dark:text-slate-100' : 'text-slate-400'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={handleKeyDownOnButton}
      >
        <span className="truncate">
          {value?.trim() ? value : placeholder ?? ''}
        </span>
        <svg
          className="ml-2 h-4 w-4 flex-shrink-0 text-slate-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {name && (
        <input
          type="text"
          className="sr-only"
          tabIndex={-1}
          value={value}
          name={name}
          required={required}
          onChange={() => {}}
        />
      )}
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 shadow-lg focus:outline-none dark:border-slate-700 dark:bg-slate-900">
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
            }}
            placeholder={t('categorySelectSearchPlaceholder')}
            onKeyDown={handleKeyDownOnSearch}
          />
          <ul
            role="listbox"
            aria-activedescendant={
              highlightedIndex >= 0 ? `category-option-${highlightedIndex}` : undefined
            }
            className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                {t('categorySelectNoResults')}
              </li>
            ) : (
              options.map((option, index) => (
                <li
                  key={`${option.value}-${option.isCreateOption ? 'create' : 'option'}`}
                  id={`category-option-${index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={highlightedIndex === index}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                      highlightedIndex === index
                        ? 'bg-emerald-500 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    )}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span>{option.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
