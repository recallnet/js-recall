import React from "react";
import Link from "next/link";
import {FaArrowLeft} from 'react-icons/fa'
import {useRouter} from "next/navigation";

type BreadcrumbsProps = {
  items: {
    title: string;
    href: string;
  }[];
  className?: string;
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({items, className = ""}) => {
  const router = useRouter()

  return (
    <nav aria-label="Breadcrumb" className={`text-md text-secondary-foreground ${className}`}>
      {items.length > 0 && (
        <div className="flex items-center space-x-1">
          <FaArrowLeft className="mr-8 ml-5" onClick={() => router.back()} />
          {items.map((item, index) => (
            <span key={index} className="flex items-center space-x-1">
              {index > 0 && <span className="text-lg mx-3">/</span>}
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

