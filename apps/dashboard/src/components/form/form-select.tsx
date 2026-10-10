"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

// Themed dropdown for react-hook-form (Base UI Select). Use this instead of a
// native <select>: its option list is drawn by the OS and ignores the dark
// theme (white popup with pale text). Values are strings; schemas coerce
// numbers (z.coerce) where needed.
export function FormSelect<T extends FieldValues>({
  control,
  name,
  id,
  options,
  placeholder,
  disabled,
  invalid,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          items={options}
          value={field.value == null ? "" : String(field.value)}
          onValueChange={(value) => field.onChange(value ?? "")}
          disabled={disabled}
          name={field.name}
        >
          <SelectTrigger
            id={id}
            ref={field.ref}
            onBlur={field.onBlur}
            aria-invalid={invalid || undefined}
            className="h-9 w-full"
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
