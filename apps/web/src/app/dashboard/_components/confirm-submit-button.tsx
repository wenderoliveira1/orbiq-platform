"use client";

type Props = {
  message: string;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

export function ConfirmSubmitButton({
  message,
  children,
  className,
  "data-testid": testId,
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      data-testid={testId}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
