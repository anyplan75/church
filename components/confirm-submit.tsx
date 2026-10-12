"use client";

export function ConfirmSubmit({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={className}
      formAction={action}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
