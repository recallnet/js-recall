"use client";

import React, { ReactNode, useEffect, useState } from "react";

import { Input } from "@recallnet/ui2/components/input";

export const ImageURLInput: React.FC<
  React.JSX.IntrinsicElements["input"] & {
    sublabel?: ReactNode;
    onValidationChange: (valid: boolean) => void;
    showLabels?: boolean;
  }
> = ({
  value,
  onChange,
  sublabel,
  onValidationChange,
  showLabels = true,
  ...rest
}) => {
  const [internalInputValue, setInternalInputValue] = useState<string>(
    (value as string) || "",
  );
  const [imageLoadError, setImageLoadError] = useState(true);
  const [isAttemptingValidation, setIsAttemptingValidation] = useState(false);
  const isSyntacticallyValidUrl = URL.canParse(internalInputValue);
  const isImageValid =
    !imageLoadError && isSyntacticallyValidUrl && internalInputValue.length > 0;

  const label = sublabel ? (
    sublabel
  ) : (
    <span className="text-secondary-foreground mt-1 text-xs">
      Public PNG/JPG
    </span>
  );

  useEffect(() => {
    setInternalInputValue((value as string) || "");
  }, [value]);

  useEffect(() => {
    setImageLoadError(true);

    if (internalInputValue.length > 0 && isSyntacticallyValidUrl) {
      setIsAttemptingValidation(true);

      fetch(internalInputValue, { method: "HEAD" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }
          const contentType = response.headers.get("content-type");
          if (
            contentType &&
            (contentType.startsWith("image/png") ||
              contentType.startsWith("image/jpeg") ||
              contentType.startsWith("image/gif") ||
              contentType.startsWith("image/webp"))
          ) {
            setImageLoadError(false);
          } else {
            setImageLoadError(true);
          }
        })
        .catch(() => {
          setImageLoadError(true);
        })
        .finally(() => {
          setIsAttemptingValidation(false);
        });
    } else {
      setIsAttemptingValidation(false);
      setImageLoadError(true);
    }
  }, [internalInputValue, isSyntacticallyValidUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // we dont know if next input is valid so we change it
    setImageLoadError(true);
    setInternalInputValue(newValue);
    onChange?.(e);
  };

  useEffect(() => {
    onValidationChange(isImageValid);
  }, [onValidationChange, isImageValid]);

  return (
    <>
      <Input
        id={rest.id || "image-url-input"}
        type="url"
        className={rest.className}
        placeholder={rest.placeholder || "https://example.com/image.png"}
        value={internalInputValue}
        onChange={handleChange}
        autoFocus={rest.autoFocus}
        {...rest}
      />

      {showLabels &&
        (!internalInputValue ? (
          label
        ) : isAttemptingValidation ? (
          <span className="w-70 mt-1 animate-pulse text-xs text-blue-500">
            Validating image...
          </span>
        ) : !isImageValid ? (
          <span className="w-70 mt-1 text-xs text-red-500">
            Invalid image URL or image failed to load.
          </span>
        ) : (
          label
        ))}
    </>
  );
};
