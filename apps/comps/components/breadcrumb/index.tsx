import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { FaArrowLeft } from "react-icons/fa";

type BreadcrumbsProps = {
  items: {
    title: string;
    href: string;
  }[];
  className?: string;
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = "",
}) => {
  const router = useRouter();

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-md text-secondary-foreground ${className}`}
    >
      {items.length > 0 && (
        <div className="flex items-center space-x-1">
          <FaArrowLeft className="ml-5 mr-8" onClick={() => router.back()} />
          {items.map((item, index) => (
            <span key={index} className="flex items-center space-x-1">
              {index > 0 && <span className="mx-3 text-lg">/</span>}
              {index < items.length - 1 ? (
                <Link href={item.href} className="text-white">
                  {item.title}
                </Link>
              ) : (
                <span className="font-semibold">{item.title}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </nav>
  );
};
