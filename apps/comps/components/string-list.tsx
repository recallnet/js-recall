import React from "react";

/**
 * Props for the StringList component.
 * @property strings - The array of strings to display.
 * @property separator - The separator string to use between items (default: " / ").
 */
export interface StringListProps {
  strings: string[];
  separator?: string;
}

/**
 * Renders a list of strings separated by a custom separator.
 *
 * @param props - The props for the component.
 * @returns The rendered string list.
 * @example
 * <StringList strings={['A', 'B', 'C']} separator=" | " />
 */
export const StringList: React.FC<StringListProps> = ({
  strings,
  separator = "/",
}) => (
  <div className="text-secondary-foreground flex items-center gap-x-2 text-xs uppercase">
    {strings.map((str, idx) => (
      <React.Fragment key={idx}>
        <span>{str}</span>
        {idx < strings.length - 1 && (
          <span aria-hidden="true">{separator}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);
