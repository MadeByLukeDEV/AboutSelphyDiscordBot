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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = {
  value: string;
  /** What the closed field shows once chosen. */
  label: string;
  /** What the list row shows when it differs (e.g. no category under a category heading). */
  text?: string;
  /** Heading the option is listed under. Neighbouring options with the same heading share one. */
  group?: string;
};

// Consecutive options with the same group become one heading. Consecutive, not
// "all with the same name": two categories can share a name and must stay apart.
function toRuns(options: SelectOption[]) {
  const runs: Array<{ group?: string; options: SelectOption[] }> = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}

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
  const runs = toRuns(options);

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
            {runs.map((run, index) => {
              const items = run.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.text ?? option.label}
                </SelectItem>
              ));
              return run.group ? (
                <SelectGroup key={`${index}-${run.group}`}>
                  <SelectLabel>{run.group}</SelectLabel>
                  {items}
                </SelectGroup>
              ) : (
                items
              );
            })}
          </SelectContent>
        </Select>
      )}
    />
  );
}
