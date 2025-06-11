import { Check, XCircle } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * A component that renders a toaster for displaying notifications.
 *
 * @param props The props for the `SonnerToaster` component.
 * @returns A styled `Toaster` component.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      closeButton
      toastOptions={{
        unstyled: true,
        closeButton: false,
        classNames: {
          toast:
            "group toast flex gap-x-3 rounded-lg border bg-gray-900 p-4 text-white data-[type=success]:border-green-400 data-[type=error]:border-red-500 items-center",
          title:
            "font-semibold group-data-[type=success]:text-green-400 group-data-[type=error]:text-red-500 text-sm",
          description: "text-gray-100 text-sm",
          closeButton: "text-gray-100 hover:text-white",
        },
      }}
      icons={{
        success: <Check size={20} className="text-green-400" />,
        error: <XCircle size={20} className="text-red-500" />,
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
